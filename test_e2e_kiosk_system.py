import urllib.request
import urllib.error
import json
import time
import math
import ctypes
import sqlite3
from datetime import datetime, timezone, timedelta

BASE_URL = "http://127.0.0.1:8000/api/v1"

def gen_vector(user_id: int):
    vec = []
    for i in range(128):
        h = ctypes.c_uint32(2166136261 ^ user_id).value
        h = ctypes.c_uint32(ctypes.c_int32(h ^ i).value * 16777619).value
        h = ctypes.c_uint32(ctypes.c_int32(h ^ (i * 31)).value * -2048144789).value
        val = (h % 10000) / 10000.0 - 0.5
        vec.append(val)
    mag = math.sqrt(sum(x*x for x in vec))
    return [round(x / mag, 4) for x in vec]

def post_json(url, data):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req) as response:
            status_code = response.getcode()
            body = json.loads(response.read().decode("utf-8"))
            return status_code, body
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        print(f"HTTPError {e.code}: {raw}")
        try:
            body = json.loads(raw)
        except Exception:
            body = {"raw": raw}
        return e.code, body

def run_tests():
    print("=" * 60)
    print("RUNNING END-TO-END FLOWPEOPLE FACE RECOGNITION KIOSK TEST")
    print("=" * 60)

    # 0. Clean today's test records for users 4, 5, 6 for idempotent clean run
    conn = sqlite3.connect("backend/hrms.db")
    cur = conn.cursor()
    cur.execute("SELECT id FROM attendance_records WHERE user_id IN (4, 5, 6) AND date = date('now')")
    recs = [r[0] for r in cur.fetchall()]
    if recs:
        placeholders = ','.join('?' * len(recs))
        cur.execute(f"DELETE FROM attendance_punches WHERE attendance_record_id IN ({placeholders})", recs)
        cur.execute(f"DELETE FROM attendance_records WHERE id IN ({placeholders})", recs)
        conn.commit()
    conn.close()

    # 1. Test Unregistered / Random Face Rejection
    print("\n[TEST 1] Testing Unregistered Face (Should Reject with 400)...")
    random_vec = json.dumps([round(math.sin(i * 3.7) * 0.4, 4) for i in range(128)])
    status, body = post_json(f"{BASE_URL}/biometrics/kiosk/scan", {
        "face_data": random_vec,
        "liveness_data": {
            "timestamp": int(time.time() * 1000),
            "motion_score": 0.95,
            "blink_detected": True,
            "frame_variance": 0.91
        },
        "device": "Company Entrance Kiosk"
    })
    print(f"Status Code: {status}")
    assert status == 400, f"Expected 400, got {status}: {body}"
    detail = body.get("detail", "")
    print(f"Server response: '{detail}'")
    assert "Face Not Recognized" in detail or "below required match threshold" in detail
    print("PASS: Unregistered face properly rejected!")

    # 2. Test Sequential Employee Morning Check-Ins
    # Test Employee: Rahul Sharma (User ID 4)
    print("\n[TEST 2] Employee #1 (Rahul Sharma, ID 4) Scans Face at Entrance...")
    rahul_vec = json.dumps(gen_vector(4))
    status1, data1 = post_json(f"{BASE_URL}/biometrics/kiosk/scan", {
        "face_data": rahul_vec,
        "liveness_data": {
            "timestamp": int(time.time() * 1000),
            "motion_score": 0.96,
            "blink_detected": True,
            "frame_variance": 0.93
        },
        "device": "Company Entrance Kiosk"
    })
    print(f"Status Code: {status1}")
    assert status1 == 200, f"Expected 200, got {status1}: {data1}"
    emp1 = data1.get("employee", {})
    punch1 = data1.get("punch_type")
    print(f"Recognized Employee: {emp1.get('full_name')} ({emp1.get('employee_code')})")
    print(f"Action: {data1.get('action_label')} at {data1.get('punch_time')}")
    print(f"Confidence: {data1.get('confidence')}")
    assert emp1.get("id") == 4, f"Expected Rahul (4), got {emp1.get('id')}"
    print("PASS: Rahul Sharma recognized and morning punch registered!")

    # 3. Test Cooldown Debounce (Same employee scans again immediately)
    print("\n[TEST 3] Immediate Re-scan Debounce (< 20s cooldown)...")
    status_cd, data_cd = post_json(f"{BASE_URL}/biometrics/kiosk/scan", {
        "face_data": rahul_vec,
        "liveness_data": {
            "timestamp": int(time.time() * 1000),
            "motion_score": 0.96,
            "blink_detected": True,
            "frame_variance": 0.93
        },
        "device": "Company Entrance Kiosk"
    })
    print(f"Cooldown Response: {data_cd.get('message')}")
    assert data_cd.get("is_duplicate_cooldown") is True or data_cd.get("already_completed") is True
    print("PASS: Rapid duplicate scan safely debounced without corrupting attendance state!")

    # 4. Test Second Employee: Amit Verma (User ID 5)
    print("\n[TEST 4] Employee #2 (Amit Verma, ID 5) Steps up and Scans...")
    amit_vec = json.dumps(gen_vector(5))
    status2, data2 = post_json(f"{BASE_URL}/biometrics/kiosk/scan", {
        "face_data": amit_vec,
        "liveness_data": {
            "timestamp": int(time.time() * 1000),
            "motion_score": 0.95,
            "blink_detected": True,
            "frame_variance": 0.92
        },
        "device": "Company Entrance Kiosk"
    })
    assert status2 == 200, f"Expected 200, got: {data2}"
    emp2 = data2.get("employee", {})
    print(f"Recognized Employee: {emp2.get('full_name')} ({emp2.get('employee_code')})")
    print(f"Action: {data2.get('action_label')} at {data2.get('punch_time')}")
    assert emp2.get("id") == 5, f"Expected Amit (5), got {emp2.get('id')}"
    print("PASS: Amit Verma recognized independently and registered!")

    # 5. Test Third Employee: Priya Nair (User ID 6)
    print("\n[TEST 5] Employee #3 (Priya Nair, ID 6) Steps up and Scans...")
    priya_vec = json.dumps(gen_vector(6))
    status3, data3 = post_json(f"{BASE_URL}/biometrics/kiosk/scan", {
        "face_data": priya_vec,
        "liveness_data": {
            "timestamp": int(time.time() * 1000),
            "motion_score": 0.95,
            "blink_detected": True,
            "frame_variance": 0.92
        },
        "device": "Company Entrance Kiosk"
    })
    assert status3 == 200, f"Expected 200, got: {data3}"
    emp3 = data3.get("employee", {})
    print(f"Recognized Employee: {emp3.get('full_name')} ({emp3.get('employee_code')})")
    print(f"Action: {data3.get('action_label')} at {data3.get('punch_time')}")
    assert emp3.get("id") == 6, f"Expected Priya (6), got {emp3.get('id')}"
    print("PASS: Priya Nair recognized independently and registered!")

    # 6. Test Evening Check-Out for Rahul Sharma (User ID 4)
    # We backdate Rahul's IN punch by 8.5 hours in SQLite so it has elapsed > 20s
    print("\n[TEST 6] Evening Departure: Rahul Sharma (ID 4) Leaves and Scans Again...")
    conn = sqlite3.connect("backend/hrms.db")
    cur = conn.cursor()
    cur.execute("SELECT id FROM attendance_records WHERE user_id = 4 AND date = date('now')")
    rec = cur.fetchone()
    if rec:
        rec_id = rec[0]
        cur.execute("SELECT id FROM attendance_punches WHERE attendance_record_id = ? AND punch_type = 'IN'", (rec_id,))
        p = cur.fetchone()
        if p:
            past_time = (datetime.now(timezone.utc) - timedelta(hours=8, minutes=30)).isoformat()
            cur.execute("UPDATE attendance_punches SET punch_time = ? WHERE id = ?", (past_time, p[0]))
            conn.commit()
    conn.close()

    status_out, data_out = post_json(f"{BASE_URL}/biometrics/kiosk/scan", {
        "face_data": rahul_vec,
        "liveness_data": {
            "timestamp": int(time.time() * 1000),
            "motion_score": 0.96,
            "blink_detected": True,
            "frame_variance": 0.93
        },
        "device": "Company Entrance Kiosk"
    })
    assert status_out == 200, f"Expected 200, got: {data_out}"
    print(f"Action: {data_out.get('action_label')}")
    print(f"Punch Time: {data_out.get('punch_time')}")
    print(f"Total Work Hours: {data_out.get('working_hours_formatted')}")
    print(f"Message: {data_out.get('message')}")
    assert data_out.get("punch_type") in ["OUT", "COMPLETED"]
    print("PASS: Automatic Check-Out recorded with working duration calculated!")

    # 7. Test 3rd Scan (Session Completed)
    print("\n[TEST 7] Rahul Scans Again After Checking Out (Completed State)...")
    status_done, data_done = post_json(f"{BASE_URL}/biometrics/kiosk/scan", {
        "face_data": rahul_vec,
        "liveness_data": {
            "timestamp": int(time.time() * 1000),
            "motion_score": 0.96,
            "blink_detected": True,
            "frame_variance": 0.93
        },
        "device": "Company Entrance Kiosk"
    })
    assert status_done == 200
    print(f"Action: {data_done.get('action_label')}")
    print(f"Message: {data_done.get('message')}")
    assert data_done.get("already_completed") is True
    print("PASS: Subsequent scan correctly handled as completed for the day!")

    print("\n" + "=" * 60)
    print("ALL 7 END-TO-END KIOSK TESTS PASSED SUCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
