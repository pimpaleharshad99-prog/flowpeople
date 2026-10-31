import httpx
import json
import time

BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_full_system():
    client = httpx.Client(timeout=15.0)
    print("=== FlowPeople Automatic Face Kiosk & HR Portal Verification ===")
    
    # 1. Login as Admin
    login_resp = client.post(f"{BASE_URL}/auth/login", json={"email": "alex@flowpeople.local", "password": "Password123!"})
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[1] Admin Authenticated Successfully.")

    # 2. Get Employee List
    emp_resp = client.get(f"{BASE_URL}/users/employees", headers=headers)
    assert emp_resp.status_code == 200, f"Get employees failed: {emp_resp.text}"
    employees = emp_resp.json()
    print(f"[2] Retrieved {len(employees)} employees.")
    
    emp1 = employees[0]
    emp2 = employees[1] if len(employees) > 1 else employees[0]
    print(f"    Testing with Emp1: {emp1['full_name']} (ID: {emp1['id']})")
    print(f"    Testing with Emp2: {emp2['full_name']} (ID: {emp2['id']})")

    # 3. Create unique 128-D biometric vectors for Emp1 and Emp2
    vector_emp1 = [round(float(i * 0.01 + 0.1), 4) for i in range(128)]
    vector_emp2 = [round(float(i * -0.01 - 0.1), 4) for i in range(128)]

    # 4. Enroll Emp1 pure-camera (zero duplicate identity fields)
    enroll_resp1 = client.post(f"{BASE_URL}/biometrics/enroll", headers=headers, json={
        "face_vector": json.dumps(vector_emp1),
        "consent_given": True,
        "quality_score": 0.98,
        "target_user_id": emp1["id"]
    })
    assert enroll_resp1.status_code == 200, f"Enrollment 1 failed: {enroll_resp1.text}"
    print(f"[3] Enrolled Face Biometrics for {emp1['full_name']}: {enroll_resp1.json()}")

    # 5. Enroll Emp2 pure-camera
    enroll_resp2 = client.post(f"{BASE_URL}/biometrics/enroll", headers=headers, json={
        "face_vector": json.dumps(vector_emp2),
        "consent_given": True,
        "quality_score": 0.97,
        "target_user_id": emp2["id"]
    })
    assert enroll_resp2.status_code == 200, f"Enrollment 2 failed: {enroll_resp2.text}"
    print(f"[4] Enrolled Face Biometrics for {emp2['full_name']}: {enroll_resp2.json()}")

    # 6. Test Unregistered Face (Random vector)
    unregistered_vec = [0.999] * 128
    kiosk_unreg = client.post(f"{BASE_URL}/biometrics/kiosk/scan", json={
        "face_data": json.dumps(unregistered_vec),
        "liveness_data": {"motion_score": 0.95, "blink_detected": True}
    })
    print(f"[5] Unregistered Face Scan Result (Status {kiosk_unreg.status_code}): {kiosk_unreg.json()}")
    assert kiosk_unreg.status_code == 404
    assert "Face Not Recognized" in kiosk_unreg.json()["detail"] or "Face Registration Pending" in kiosk_unreg.json()["detail"]

    # 7. Test Sequential Scan: Emp1 First Punch (CHECK-IN)
    kiosk_emp1_scan1 = client.post(f"{BASE_URL}/biometrics/kiosk/scan", json={
        "face_data": json.dumps(vector_emp1),
        "liveness_data": {"motion_score": 0.95, "blink_detected": True}
    })
    print(f"[6] Emp1 Scan 1 (Check-In) Result: {kiosk_emp1_scan1.status_code} -> {kiosk_emp1_scan1.json()}")
    assert kiosk_emp1_scan1.status_code == 200
    res1 = kiosk_emp1_scan1.json()
    assert res1["success"] is True
    assert res1["employee_id"] == emp1["id"]
    print(f"    Punch Type: {res1.get('punch_type')}, Message: {res1.get('message')}")

    # 8. Test Debounce Cooldown: Emp1 Immediate Rescan (< 20s)
    kiosk_emp1_rescan = client.post(f"{BASE_URL}/biometrics/kiosk/scan", json={
        "face_data": json.dumps(vector_emp1),
        "liveness_data": {"motion_score": 0.95, "blink_detected": True}
    })
    print(f"[7] Emp1 Immediate Rescan Result: {kiosk_emp1_rescan.status_code} -> {kiosk_emp1_rescan.json()}")
    assert kiosk_emp1_rescan.status_code == 200
    res_cooldown = kiosk_emp1_rescan.json()
    assert res_cooldown.get("is_duplicate_cooldown") is True or res_cooldown.get("already_completed") is True

    # 9. Test Sequential Scan: Emp2 First Punch (CHECK-IN)
    kiosk_emp2_scan1 = client.post(f"{BASE_URL}/biometrics/kiosk/scan", json={
        "face_data": json.dumps(vector_emp2),
        "liveness_data": {"motion_score": 0.95, "blink_detected": True}
    })
    print(f"[8] Emp2 Scan 1 Result: {kiosk_emp2_scan1.status_code} -> {kiosk_emp2_scan1.json()}")
    assert kiosk_emp2_scan1.status_code == 200
    res2 = kiosk_emp2_scan1.json()
    assert res2["success"] is True
    assert res2["employee_id"] == emp2["id"]

    # 10. Check HR Attendance Dashboard API
    hr_dash = client.get(f"{BASE_URL}/attendance/hr-dashboard", headers=headers)
    assert hr_dash.status_code == 200, f"HR Dashboard failed: {hr_dash.text}"
    dash_data = hr_dash.json()
    print("[9] HR Attendance Dashboard Verified:")
    print(f"    Total Employees: {dash_data['total_employees']}")
    print(f"    Present Today: {dash_data['present_today']}")
    print(f"    Currently Working: {dash_data['currently_checked_in']}")
    print(f"    Checked Out Today: {dash_data['checked_out_today']}")
    print(f"    Incomplete Attendance: {dash_data['incomplete_attendance']}")
    print(f"    Employees in Roster: {len(dash_data['employees'])}")

    # 11. Check Employee Attendance History API
    hist_resp = client.get(f"{BASE_URL}/attendance/employee-history/{emp1['id']}", headers=headers)
    assert hist_resp.status_code == 200, f"Employee history failed: {hist_resp.text}"
    hist_records = hist_resp.json()
    print(f"[10] Employee Attendance History for {emp1['full_name']} Verified:")
    print(f"    Found {len(hist_records)} daily attendance records.")
    if len(hist_records) > 0:
        latest = hist_records[0]
        print(f"    Latest Record: Date={latest['date']}, Status={latest['status']}, In={latest['first_check_in']}, Out={latest['last_check_out']}, Punches={len(latest['punches'])}")

    print("\n>>> ALL SYSTEM VERIFICATIONS PASSED 100% SUCCESSFUL! <<<")

if __name__ == "__main__":
    test_full_system()
