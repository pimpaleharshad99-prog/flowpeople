import sqlite3

def purge_all_demo_data():
    conn = sqlite3.connect("hrms.db")
    cur = conn.cursor()

    # Identify demo users (all users except real admin accounts)
    cur.execute("SELECT id, email, first_name, last_name, role FROM users WHERE email NOT IN ('pimpaleharshad99@gmail.com', 'pimpaleg80@gmail.com')")
    demo_users = cur.fetchall()
    demo_ids = [u[0] for u in demo_users]

    print(f"Found {len(demo_ids)} demo users to purge:")
    for u in demo_users[:10]:
        print(f"  - [{u[0]}] {u[2]} {u[3]} ({u[1]}) - {u[4]}")
    if len(demo_users) > 10:
        print(f"  ... and {len(demo_users) - 10} more.")

    if not demo_ids:
        print("No demo users found!")
        conn.close()
        return

    placeholders = ','.join('?' * len(demo_ids))

    # 1. Attendance punches
    cur.execute(f"""
        DELETE FROM attendance_punches 
        WHERE attendance_record_id IN (
            SELECT id FROM attendance_records WHERE user_id IN ({placeholders})
        )
    """, demo_ids)
    print(f"Purged attendance punches for demo users.")

    # 2. Attendance regularizations & records
    cur.execute(f"DELETE FROM attendance_regularizations WHERE user_id IN ({placeholders}) OR approver_id IN ({placeholders})", demo_ids + demo_ids)
    cur.execute(f"DELETE FROM attendance_records WHERE user_id IN ({placeholders})", demo_ids)
    print("Purged attendance records and regularizations.")

    # 3. Biometric enrollments & logs
    cur.execute(f"DELETE FROM face_verification_logs WHERE user_id IN ({placeholders})", demo_ids)
    cur.execute(f"DELETE FROM face_enrollments WHERE user_id IN ({placeholders}) OR revoked_by_id IN ({placeholders})", demo_ids + demo_ids)
    cur.execute(f"DELETE FROM fingerprint_enrollments WHERE user_id IN ({placeholders})", demo_ids)
    print("Purged biometric enrollments and logs.")

    # 4. Leave balances, requests, and approvals
    cur.execute(f"""
        DELETE FROM leave_approvals 
        WHERE leave_request_id IN (
            SELECT id FROM leave_requests WHERE user_id IN ({placeholders})
        )
    """, demo_ids)
    cur.execute(f"DELETE FROM leave_requests WHERE user_id IN ({placeholders})", demo_ids)
    cur.execute(f"DELETE FROM leave_balances WHERE user_id IN ({placeholders})", demo_ids)
    print("Purged leave records.")

    # 5. Shift assignments
    cur.execute(f"DELETE FROM shift_assignments WHERE user_id IN ({placeholders})", demo_ids)

    # 6. Employee documents, HR tickets, notifications
    cur.execute(f"DELETE FROM employee_documents WHERE user_id IN ({placeholders})", demo_ids)
    cur.execute(f"DELETE FROM hr_tickets WHERE user_id IN ({placeholders}) OR assigned_to_id IN ({placeholders})", demo_ids + demo_ids)
    cur.execute(f"DELETE FROM notifications WHERE user_id IN ({placeholders})", demo_ids)

    # 7. Goals, performance reviews, onboarding, lifecycle
    cur.execute(f"DELETE FROM goals WHERE user_id IN ({placeholders})", demo_ids)
    cur.execute(f"DELETE FROM performance_reviews WHERE user_id IN ({placeholders}) OR reviewer_id IN ({placeholders})", demo_ids + demo_ids)
    cur.execute(f"DELETE FROM onboarding_tasks WHERE user_id IN ({placeholders})", demo_ids)
    cur.execute(f"DELETE FROM lifecycle_records WHERE user_id IN ({placeholders})", demo_ids)

    # 8. Payroll and timesheets
    cur.execute(f"UPDATE payroll_periods SET processed_by_id = NULL WHERE processed_by_id IN ({placeholders})", demo_ids)
    cur.execute(f"UPDATE payroll_periods SET approved_by_id = NULL WHERE approved_by_id IN ({placeholders})", demo_ids)
    cur.execute(f"DELETE FROM employee_salary_structures WHERE user_id IN ({placeholders})", demo_ids)
    cur.execute(f"DELETE FROM payslips WHERE user_id IN ({placeholders})", demo_ids)
    cur.execute(f"DELETE FROM timesheets WHERE user_id IN ({placeholders}) OR approver_id IN ({placeholders})", demo_ids + demo_ids)
    cur.execute(f"DELETE FROM time_logs WHERE user_id IN ({placeholders})", demo_ids)
    cur.execute(f"DELETE FROM project_members WHERE user_id IN ({placeholders})", demo_ids)

    # 9. Clean up audit logs & user relations referencing demo users
    cur.execute(f"UPDATE audit_logs SET user_id = NULL WHERE user_id IN ({placeholders})", demo_ids)
    cur.execute(f"UPDATE users SET manager_id = NULL WHERE manager_id IN ({placeholders})", demo_ids)
    cur.execute(f"UPDATE users SET created_by_id = NULL WHERE created_by_id IN ({placeholders})", demo_ids)

    # 10. Finally purge demo users from users table
    cur.execute(f"DELETE FROM users WHERE id IN ({placeholders})", demo_ids)
    print(f"DELETED {len(demo_ids)} demo users from users table.")

    # 11. Purge dummy test companies
    cur.execute("DELETE FROM companies WHERE id NOT IN (1, 9)")
    print("Purged dummy test companies.")

    conn.commit()

    # Verify remaining users
    cur.execute("SELECT id, email, first_name, last_name, role, status FROM users")
    remaining = cur.fetchall()
    print("\nREMAINING REAL USERS IN DATABASE:")
    for r in remaining:
        print(f"  - [{r[0]}] {r[2]} {r[3]} ({r[1]}) - Role: {r[4]}, Status: {r[5]}")

    conn.close()
    print("\nSUCCESS: All demo data employees completely purged!")

if __name__ == "__main__":
    purge_all_demo_data()
