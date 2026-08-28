import sys
import os
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Ensure absolute import path works
sys.path.insert(0, str(Path(__file__).parent.parent))

from loop_keeper import store

def run_tests():
    print("=== STARTING LOOPKEEPER BACKEND CORRECTNESS TESTS ===")
    
    # 1. Reset database to seed state for testing
    import shutil
    data_dir = Path(__file__).parent / "data"
    shutil.copy(data_dir / "open_loops.seed.json", data_dir / "open_loops.json")
    print("Database reset to seed state.")

    # 2. Test Get Loop and schema defaults
    loop_id = "inv_1003"
    loop = store.get_loop(loop_id)
    assert loop is not None, "Failed to get loop"
    assert "processed_message_ids" in loop, "Schema default processed_message_ids missing"
    assert "unread_reply" in loop, "Schema default unread_reply missing"
    print("✅ Get loop & schema defaults verified.")

    # 3. Test Gmail De-duplication
    msg_id = "gmail_msg_abc123"
    summary = "I have paid invoice 1003 via check"
    
    # First log
    loop = store.log_incoming_reply(loop_id, msg_id, summary)
    assert msg_id in loop["processed_message_ids"], "Message ID not tracked"
    assert loop["unread_reply"] is True, "Unread reply flag not set"
    history_len = len(loop["history"])
    print("✅ First incoming reply logged.")

    # Second log (duplicate msg_id)
    res = store.log_incoming_reply(loop_id, msg_id, "Some other summary")
    loop_after = res["loop"] if (isinstance(res, dict) and "loop" in res) else res
    assert len(loop_after["history"]) == history_len, "Duplicate message ID created a duplicate history entry!"
    print("✅ Duplicate reply ignored successfully (De-duplication verified).")

    # 4. Test verify_and_close Agent Guard
    # Reset database so we have no payment history
    shutil.copy(data_dir / "open_loops.seed.json", data_dir / "open_loops.json")
    
    # Attempt verification by agent on an invoice with no replies
    result = store.verify_and_close(loop_id, "Closing autonomously", by_agent=True)
    assert "error" in result, "Agent closed invoice without payment confirmation!"
    print("✅ Autonomous closure blocked on zero-evidence (Agent Guard verified).")

    # 5. Test verify_and_close Agent Guard with payment evidence
    # Log payment reply
    store.log_incoming_reply(loop_id, "msg_pay_1", "I sent payment of $4200 today via wire.")
    
    # Try closing again
    result = store.verify_and_close(loop_id, "Verified wire details", by_agent=True)
    assert "error" not in result, f"Verification failed despite evidence: {result}"
    assert result["status"] == "closed", "Loop was not closed"
    assert result["unread_reply"] is False, "Unread reply flag not cleared after closure"
    print("✅ Autonomous closure succeeded with valid evidence.")

    # 6. Test manual verify_and_close bypass
    shutil.copy(data_dir / "open_loops.seed.json", data_dir / "open_loops.json")
    
    # Manual close by owner (by_agent=False) should succeed immediately
    result = store.verify_and_close(loop_id, "Owner verified bank check", by_agent=False)
    assert "error" not in result, f"Manual verification blocked: {result}"
    assert result["status"] == "closed", "Manual closure failed"
    print("✅ Manual closure bypass succeeded.")

    print("\n=== ALL CORRECTNESS TESTS PASSED SUCCESSFULLY ===")

if __name__ == "__main__":
    run_tests()
