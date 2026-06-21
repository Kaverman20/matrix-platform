#!/usr/bin/env python3
"""
matrix-keycloak-sync
====================
Synchronizes Matrix Space/Room membership from Keycloak groups.

Usage:
    python sync.py              # run once
    python sync.py --watch      # repeat every SYNC_INTERVAL seconds
    python sync.py --dry-run    # print changes without applying them
"""

import argparse
import logging
import os
import re
import sys
import time
from typing import Optional
from urllib.parse import quote

import requests
import yaml
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("matrix-keycloak-sync")

# Allowed characters in a Matrix localpart (per spec, plus the leading-@ we add).
LOCALPART_RE = re.compile(r"^[a-z0-9._=\-/]+$")


def seg(value: str) -> str:
    """Percent-encode a single URL path segment (room ids, mxids, group ids come
    from Keycloak/Synapse responses and contain @, :, ! that must be escaped)."""
    return quote(str(value), safe="")


def errcode_of(resp: requests.Response) -> str:
    """Matrix errcode from a response body, '' if the body isn't JSON (e.g. an
    HTML 5xx error page) so callers never crash on resp.json()."""
    try:
        return resp.json().get("errcode", "")
    except ValueError:
        return ""


def make_session(retries: int = 3) -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=retries,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session


class KeycloakClient:
    def __init__(
        self,
        base_url: str,
        realm: str,
        client_id: str,
        client_secret: str,
    ):
        self.base_url = base_url.rstrip("/")
        self.realm = realm
        self.client_id = client_id
        self.client_secret = client_secret
        self._token: Optional[str] = None
        self.session = make_session()

    def _get_token(self) -> str:
        url = f"{self.base_url}/realms/{self.realm}/protocol/openid-connect/token"
        resp = self.session.post(
            url,
            data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "client_credentials",
            },
        )
        resp.raise_for_status()
        return resp.json()["access_token"]

    @property
    def token(self) -> str:
        if not self._token:
            self._token = self._get_token()
        return self._token

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"}

    def _admin_url(self, path: str) -> str:
        return f"{self.base_url}/admin/realms/{self.realm}/{path.lstrip('/')}"

    def get_group_by_path(self, group_path: str) -> Optional[dict]:
        parts = group_path.strip("/").split("/")
        name = parts[-1]

        resp = self.session.get(
            self._admin_url("groups"),
            headers=self._headers(),
            params={"search": name, "exact": "true"},
        )
        if resp.status_code == 401:
            self._token = self._get_token()
            resp = self.session.get(
                self._admin_url("groups"),
                headers=self._headers(),
                params={"search": name, "exact": "true"},
            )
        resp.raise_for_status()

        for group in resp.json():
            if group.get("path") == group_path:
                return group
        return None

    def get_group_members(self, group_id: str) -> list[dict]:
        members = []
        first = 0
        max_results = 100

        while True:
            resp = self.session.get(
                self._admin_url(f"groups/{seg(group_id)}/members"),
                headers=self._headers(),
                params={"first": first, "max": max_results},
            )
            resp.raise_for_status()
            batch = resp.json()
            members.extend(batch)
            if len(batch) < max_results:
                break
            first += max_results

        return members

    def get_all_users(self) -> list[dict]:
        users = []
        first = 0
        max_results = 100

        while True:
            resp = self.session.get(
                self._admin_url("users"),
                headers=self._headers(),
                params={"first": first, "max": max_results},
            )
            resp.raise_for_status()
            batch = resp.json()
            users.extend(batch)
            if len(batch) < max_results:
                break
            first += max_results

        return users


class MatrixClient:
    def __init__(self, homeserver_url: str, access_token: str, server_name: str):
        self.base_url = homeserver_url.rstrip("/")
        self.token = access_token
        self.server_name = server_name
        self.session = make_session()

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    def _client_url(self, path: str) -> str:
        return f"{self.base_url}/_matrix/client/v3/{path.lstrip('/')}"

    def _synapse_admin_url(self, path: str) -> str:
        return f"{self.base_url}/_synapse/admin/v1/{path.lstrip('/')}"

    def get_room_members(self, room_id: str) -> list[str]:
        resp = self.session.get(
            self._client_url(f"rooms/{seg(room_id)}/joined_members"),
            headers=self._headers(),
        )
        if resp.status_code == 404:
            log.warning("Room %s not found", room_id)
            return []
        resp.raise_for_status()
        return list(resp.json().get("joined", {}).keys())

    def invite_user(self, room_id: str, mxid: str) -> bool:
        resp = self.session.post(
            self._client_url(f"rooms/{seg(room_id)}/invite"),
            headers=self._headers(),
            json={"user_id": mxid},
        )
        if resp.status_code == 200:
            return True
        err = errcode_of(resp)
        if err == "M_ALREADY_IN_ROOM":
            return True
        log.warning("Invite %s to %s: %s %s", mxid, room_id, resp.status_code, err)
        return False

    def force_join_user(self, room_id: str, mxid: str) -> bool:
        resp = self.session.post(
            self._synapse_admin_url(f"join/{seg(room_id)}"),
            headers=self._headers(),
            json={"user_id": mxid},
        )
        if resp.status_code == 200:
            return True
        log.warning(
            "Force-join %s to %s: %s %s",
            mxid,
            room_id,
            resp.status_code,
            errcode_of(resp),
        )
        return False

    def kick_user(self, room_id: str, mxid: str, reason: str = "Access revoked") -> bool:
        resp = self.session.post(
            self._client_url(f"rooms/{seg(room_id)}/kick"),
            headers=self._headers(),
            json={"user_id": mxid, "reason": reason},
        )
        if resp.status_code == 200:
            return True
        err = errcode_of(resp)
        if err == "M_NOT_IN_ROOM":
            return True
        log.warning("Kick %s from %s: %s %s", mxid, room_id, resp.status_code, err)
        return False

    def mxid_from_username(self, username: str) -> str:
        localpart = username.lower()
        if not LOCALPART_RE.match(localpart):
            raise ValueError(f"Invalid Matrix localpart from username {username!r}")
        return f"@{localpart}:{self.server_name}"

    def user_exists(self, mxid: str) -> bool:
        resp = self.session.get(
            f"{self.base_url}/_synapse/admin/v2/users/{seg(mxid)}",
            headers=self._headers(),
        )
        if resp.status_code == 200:
            return True
        if resp.status_code == 404:
            return False
        # 401/403/5xx: don't silently treat the user as absent (which would skip
        # them from sync) — raise so the run fails loudly instead.
        resp.raise_for_status()
        return False

    def list_all_users(self) -> list[dict]:
        users = []
        frm = 0
        limit = 100
        while True:
            resp = self.session.get(
                f"{self.base_url}/_synapse/admin/v2/users",
                headers=self._headers(),
                params={"from": frm, "limit": limit, "guests": "false"},
            )
            resp.raise_for_status()
            data = resp.json()
            batch = data.get("users", [])
            users.extend(batch)
            if "next_token" in data and data["next_token"] is not None:
                frm = int(data["next_token"])
            else:
                break
        return users

    def deactivate_user(self, mxid: str) -> bool:
        resp = self.session.post(
            f"{self.base_url}/_synapse/admin/v1/deactivate/{seg(mxid)}",
            headers=self._headers(),
            json={"erase": False},
        )
        if resp.status_code == 200:
            return True
        log.warning("Deactivate %s: %s %s", mxid, resp.status_code, errcode_of(resp))
        return False


class GroupSyncer:
    def __init__(
        self,
        keycloak: KeycloakClient,
        matrix: MatrixClient,
        mappings: list[dict],
        dry_run: bool = False,
        use_force_join: bool = False,
        revoke_access: bool = True,
        gate_group: Optional[str] = None,
        deactivate_on_gate_loss: bool = False,
        bot_username: str = "sync-bot",
        max_deactivations: int = 10,
    ):
        self.kc = keycloak
        self.mx = matrix
        self.mappings = mappings
        self.dry_run = dry_run
        self.use_force_join = use_force_join
        self.revoke_access = revoke_access
        self.gate_group = gate_group
        self.deactivate_on_gate_loss = deactivate_on_gate_loss
        self.bot_username = bot_username.lower()
        self.max_deactivations = max_deactivations

    def _keycloak_username_to_mxid(self, kc_user: dict) -> Optional[str]:
        username = kc_user.get("username")
        if not username:
            return None
        try:
            mxid = self.mx.mxid_from_username(username)
        except ValueError as error:
            log.warning("Skipping Keycloak user: %s", error)
            return None
        if not self.mx.user_exists(mxid):
            log.debug("Matrix account %s does not exist yet", mxid)
            return None
        return mxid

    def sync_room(self, room_id: str, expected_mxids: set[str]) -> dict:
        current_members = set(self.mx.get_room_members(room_id))
        bot_mxid = f"@{os.getenv('MATRIX_BOT_USERNAME', 'sync-bot')}:{self.mx.server_name}"
        current_human = current_members - {bot_mxid}

        to_add = expected_mxids - current_human
        to_remove = current_human - expected_mxids if self.revoke_access else set()

        result = {"added": [], "removed": [], "skipped_add": [], "skipped_remove": []}

        for mxid in to_add:
            log.info("  + Add %s to %s%s", mxid, room_id, " [DRY RUN]" if self.dry_run else "")
            if not self.dry_run:
                ok = (
                    self.mx.force_join_user(room_id, mxid)
                    if self.use_force_join
                    else self.mx.invite_user(room_id, mxid)
                )
                if ok:
                    result["added"].append(mxid)
                else:
                    result["skipped_add"].append(mxid)
            else:
                result["added"].append(mxid)

        for mxid in to_remove:
            log.info(
                "  - Remove %s from %s%s",
                mxid,
                room_id,
                " [DRY RUN]" if self.dry_run else "",
            )
            if not self.dry_run:
                ok = self.mx.kick_user(room_id, mxid)
                if ok:
                    result["removed"].append(mxid)
                else:
                    result["skipped_remove"].append(mxid)
            else:
                result["removed"].append(mxid)

        return result

    def enforce_gate_deactivation(self) -> None:
        if not self.gate_group:
            return
        log.info("Gate deactivation by group: %s", self.gate_group)

        gate = self.kc.get_group_by_path(self.gate_group)
        if not gate:
            log.warning(
                "Gate group %s was not found; skipping deactivation for safety",
                self.gate_group,
            )
            return

        allowed = {m.get("username", "").lower() for m in self.kc.get_group_members(gate["id"])}
        kc_all = {u.get("username", "").lower() for u in self.kc.get_all_users()}
        log.info("Gate members: %s, Keycloak users: %s", len(allowed), len(kc_all))

        to_deactivate = []
        for user in self.mx.list_all_users():
            mxid = user.get("name", "")
            if user.get("deactivated"):
                continue
            localpart = mxid[1:].split(":", 1)[0].lower() if mxid.startswith("@") else ""
            if not localpart or localpart == self.bot_username:
                continue
            if localpart not in kc_all:
                continue
            if localpart not in allowed:
                to_deactivate.append(mxid)

        if not to_deactivate:
            log.info("No accounts to deactivate")
            return

        # Safety brake: a bad Keycloak response (e.g. the gate group momentarily
        # returns 0 members) must not trigger a mass deactivation. Refuse to act
        # when the batch exceeds the configured ceiling.
        if len(to_deactivate) > self.max_deactivations:
            log.error(
                "Refusing to deactivate %s accounts in one run (limit %s); "
                "raise MAX_DEACTIVATIONS to override if this is expected",
                len(to_deactivate),
                self.max_deactivations,
            )
            return

        for mxid in to_deactivate:
            log.info(
                "  ! Deactivate %s, missing %s%s",
                mxid,
                self.gate_group,
                " [DRY RUN]" if self.dry_run else "",
            )
            if not self.dry_run and self.deactivate_on_gate_loss:
                self.mx.deactivate_user(mxid)

    def run(self) -> None:
        log.info("=" * 60)
        log.info("Starting sync%s", " [DRY RUN]" if self.dry_run else "")
        log.info("=" * 60)

        self.enforce_gate_deactivation()

        for mapping in self.mappings:
            group_path = mapping["keycloak_group"]
            log.info("Group: %s", group_path)

            group = self.kc.get_group_by_path(group_path)
            if not group:
                log.warning("Keycloak group %s was not found; skipping", group_path)
                continue

            kc_members = self.kc.get_group_members(group["id"])
            log.info("Keycloak members: %s", len(kc_members))

            expected_mxids = set()
            for member in kc_members:
                mxid = self._keycloak_username_to_mxid(member)
                if mxid:
                    expected_mxids.add(mxid)

            log.info("Matrix accounts: %s", len(expected_mxids))

            for space_id in mapping.get("matrix_spaces", []):
                log.info("Space: %s", space_id)
                result = self.sync_room(space_id, expected_mxids)
                log_sync_result(result)

            for room_id in mapping.get("matrix_rooms", []):
                log.info("Room: %s", room_id)
                result = self.sync_room(room_id, expected_mxids)
                log_sync_result(result)

        log.info("Sync complete")


def log_sync_result(result: dict) -> None:
    log.info(
        "Added: %s, removed: %s, skipped: %s",
        len(result["added"]),
        len(result["removed"]),
        len(result["skipped_add"]) + len(result["skipped_remove"]),
    )


def load_config() -> dict:
    required = [
        "KEYCLOAK_URL",
        "KEYCLOAK_REALM",
        "KEYCLOAK_CLIENT_ID",
        "KEYCLOAK_CLIENT_SECRET",
        "MATRIX_HOMESERVER_URL",
        "MATRIX_ACCESS_TOKEN",
        "MATRIX_SERVER_NAME",
    ]
    missing = [key for key in required if not os.getenv(key)]
    if missing:
        log.error("Missing environment variables: %s", ", ".join(missing))
        sys.exit(1)

    return {
        "keycloak_url": os.environ["KEYCLOAK_URL"],
        "keycloak_realm": os.environ["KEYCLOAK_REALM"],
        "keycloak_client_id": os.environ["KEYCLOAK_CLIENT_ID"],
        "keycloak_client_secret": os.environ["KEYCLOAK_CLIENT_SECRET"],
        "matrix_homeserver_url": os.environ["MATRIX_HOMESERVER_URL"],
        "matrix_access_token": os.environ["MATRIX_ACCESS_TOKEN"],
        "matrix_server_name": os.environ["MATRIX_SERVER_NAME"],
        "use_force_join": os.getenv("USE_FORCE_JOIN", "true").lower() == "true",
        "revoke_access": os.getenv("REVOKE_ACCESS", "true").lower() == "true",
        "sync_interval": int(os.getenv("SYNC_INTERVAL", "300")),
        "mapping_file": os.getenv("MAPPING_FILE", "mapping.yaml"),
        "gate_group": os.getenv("GATE_GROUP", "") or None,
        "deactivate_on_gate_loss": os.getenv("DEACTIVATE_ON_GATE_LOSS", "false").lower() == "true",
        "bot_username": os.getenv("MATRIX_BOT_USERNAME", "sync-bot"),
        "max_deactivations": int(os.getenv("MAX_DEACTIVATIONS", "10")),
    }


def load_mappings(path: str) -> list[dict]:
    with open(path, "r", encoding="utf-8") as file:
        data = yaml.safe_load(file)
    return data.get("mappings", [])


def main() -> None:
    parser = argparse.ArgumentParser(description="Keycloak to Matrix group sync")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without applying")
    parser.add_argument("--watch", action="store_true", help="Run periodically")
    args = parser.parse_args()

    config = load_config()
    mappings = load_mappings(config["mapping_file"])
    log.info("Loaded %s mapping rules from %s", len(mappings), config["mapping_file"])

    keycloak = KeycloakClient(
        base_url=config["keycloak_url"],
        realm=config["keycloak_realm"],
        client_id=config["keycloak_client_id"],
        client_secret=config["keycloak_client_secret"],
    )
    matrix = MatrixClient(
        homeserver_url=config["matrix_homeserver_url"],
        access_token=config["matrix_access_token"],
        server_name=config["matrix_server_name"],
    )
    syncer = GroupSyncer(
        keycloak=keycloak,
        matrix=matrix,
        mappings=mappings,
        dry_run=args.dry_run,
        use_force_join=config["use_force_join"],
        revoke_access=config["revoke_access"],
        gate_group=config["gate_group"],
        deactivate_on_gate_loss=config["deactivate_on_gate_loss"],
        bot_username=config["bot_username"],
        max_deactivations=config["max_deactivations"],
    )

    if args.watch:
        interval = config["sync_interval"]
        log.info("Watch mode: syncing every %s seconds", interval)
        while True:
            try:
                syncer.run()
            except Exception as error:
                log.error("Sync failed: %s", error, exc_info=True)
            log.info("Next run in %s seconds", interval)
            time.sleep(interval)
    else:
        syncer.run()


if __name__ == "__main__":
    main()
