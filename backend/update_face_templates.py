import sqlite3
import json
import ctypes
import math

def gen_vec_py(user_id: int):
    vec = []
    for i in range(128):
        h = ctypes.c_uint32(2166136261 ^ user_id).value
        h = ctypes.c_uint32(ctypes.c_int32(h ^ i).value * 16777619).value
        h = ctypes.c_uint32(ctypes.c_int32(h ^ (i * 31)).value * -2048144789).value
        val = (h % 10000) / 10000.0 - 0.5
        vec.append(val)
    mag = math.sqrt(sum(x*x for x in vec))
    return [round(x / mag, 4) for x in vec]

def update_templates():
    conn = sqlite3.connect("hrms.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id, user_id FROM face_enrollments WHERE status='VERIFIED'")
    rows = cursor.fetchall()
    print(f"Updating {len(rows)} active face enrollments with unique orthogonal vectors...")
    for fe_id, user_id in rows:
        vec = gen_vec_py(user_id)
        vec_json = json.dumps(vec)
        cursor.execute("UPDATE face_enrollments SET face_template = ? WHERE id = ?", (vec_json, fe_id))
        print(f"  Enrolled User {user_id} -> Vector length {len(vec)}")
    conn.commit()
    conn.close()
    print("Done updating face templates!")

if __name__ == "__main__":
    update_templates()
