








"""
simulate_reply.py — demo utilities. Neither of these touch real email;
both exist so you can rehearse and shoot the "evolving client" demo
without a real client cooperating on camera.

Usage:

    # reset the whole registry back to the clean seed state
    python simulate_reply.py --reset

    # inject a reply into a loop's history, exactly like a real Gmail
    # reply would once that's wired in — the agent picks it up on its
    # next run the same way either way
    python simulate_reply.py inv_1005 "we'll pay by Friday"

    # advance the clock on a promise so "Friday" has now passed without
    # payment, without waiting for a real Friday
    python simulate_reply.py --break-promise inv_1005
"""

import json
import shutil
import sys
from datetime import date
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
LIVE = DATA_DIR / "open_loops.json"
LIVE_CLIENTS = DATA_DIR / "clients.json"
SEED = DATA_DIR / "open_loops.seed.json"
SEED_CLIENTS = DATA_DIR / "clients.seed.json"


def reset():
    shutil.copy(SEED, LIVE)
    shutil.copy(SEED_CLIENTS, LIVE_CLIENTS)
    print("Registry reset to the clean seed state.")


def inject_reply(loop_id: str, reply_text: str):
    data = json.loads(LIVE.read_text())
    if loop_id not in data["loops"]:
        print(f"No loop with id {loop_id}. Known ids: {list(data['loops'])}")
        sys.exit(1)
    data["loops"][loop_id]["history"].append(
        {"date": str(date.today()), "event": f"[email] client replied: {reply_text}"}
    )
    LIVE.write_text(json.dumps(data, indent=2))
    print(f"Injected reply into {loop_id}. Run the agent again to see it react.")


def break_promise(loop_id: str):
    """Mark a promised date as having passed with no payment, without
    waiting for a real calendar date during rehearsal."""
    data = json.loads(LIVE.read_text())
    loop = data["loops"].get(loop_id)
    if not loop:
        print(f"No loop with id {loop_id}.")
        sys.exit(1)
    loop["history"].append(
        {"date": str(date.today()), "event": "the promised payment date has now passed with no payment"}
    )
    LIVE.write_text(json.dumps(data, indent=2))
    print(f"{loop_id}: promised date now marked as passed. Run the agent again.")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print(__doc__)
    elif args[0] == "--reset":
        reset()
    elif args[0] == "--break-promise":
        break_promise(args[1])
    else:
        inject_reply(args[0], " ".join(args[1:]))














