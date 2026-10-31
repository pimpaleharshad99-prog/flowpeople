import sqlite3

def inspect():
    conn = sqlite3.connect("hrms.db")
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = [row[0] for row in cursor.fetchall()]
    print(f"Total Database Tables Found: {len(tables)}\n")
    for t in tables:
        try:
            cursor.execute(f"SELECT count(*) FROM [{t}]")
            cnt = cursor.fetchone()[0]
            print(f"Table: {t:<32} Rows: {cnt}")
        except Exception as e:
            print(f"Table: {t:<32} Error: {e}")
    conn.close()

if __name__ == "__main__":
    inspect()

