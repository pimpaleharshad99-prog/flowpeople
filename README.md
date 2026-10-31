# FlowPeople — Modern All-in-One HRMS Platform

> **FlowPeople** is the complete workforce management platform under the **FlowCraft** ecosystem.  
> **Brand Tagline:** *People First. Work Smarter.*  
> **Product Description:** Modern All-in-One Human Resource Management System.

---

## 🌟 Workforce Management Modules

- **HR Dashboard**: Real-time workforce metrics, live attendance radar, leave balance progress, company notice board, and upcoming holidays.
- **Employee Directory**: Complete employee master records, organizational reporting hierarchy, role-based access, and instant onboarding workflows.
- **Organization Directory**: Department structures, job designation frameworks, and annual company holiday calendars.
- **Attendance Management**: Web attendance terminal, geolocation verification, dynamic work duration, break tracking, overtime calculation, and missed-punch regularization.
- **Leave Management**: Configurable leave policies (Casual, Sick, Privilege, Parental), quota accrual engine, weekend sandwich rules, and self-service cancellation with quota refunds.
- **Shift Management**: Configurable shift rosters (General Day, Early Bird, Night Owl), grace thresholds, and shift rotation mapping.
- **Project & Time Tracking**: Project milestones, live stopwatch timer, and manual time logging with billable/non-billable categorization.
- **Timesheets**: Weekly work aggregation, submission to managers, and approval status tracking.
- **Employee Self-Service (ESS)**: Clock-in/out, leave applications, personal balances, and project time logging.
- **Manager Self-Service (MSS)**: Centralized tri-tab Approvals Inbox for Leaves, Regularizations, and Timesheets with 1-click approvals and comments.
- **HR Helpdesk & Announcements**: Company-wide notice feed with priority flags (Normal, Important, Urgent).
- **Reports & Analytics**: Aggregated compliance rates, department headcount distribution, and overtime trends.

---

## 🎨 Visual Brand Identity: FlowPeople by FlowCraft

- **Brand Palette**: Premium blue (`#2563EB`) and teal (`#0D9488`) with slate neutral foundations.
- **Typography**: Clean, accessible sans-serif interface with monospace data formatting for clocks, timestamps, and employee codes.
- **Logo Mark**: FlowPeople dual-tone gradient badge with "FP" monogram and active presence indicator.
- **Design Language**: Smooth rounded corners (`rounded-xl`, `rounded-2xl`), subtle borders, soft elevation shadows, and high contrast accessibility.

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- Python 3.10+ (Tested on Python 3.14)
- Node.js v18+ (Tested on Node v24)
- npm or yarn

### 2. Backend Setup
```bash
cd backend

# 1. Activate virtual environment
# Windows:
.\.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Seed demo company & data
python -m app.seed.demo_data

# 4. Run backend server (Port 8000)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive REST API Documentation (Swagger) is available at: `http://127.0.0.1:8000/api/v1/docs`

### 3. Frontend Setup
```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Run development server (Port 5173)
npm run dev
```
Open your browser at: `http://127.0.0.1:5173`

---

## 👥 Demo User Personas (Pre-configured in Top Header Switcher)

Switch personas instantly using the top-bar role selector:

| Persona | Email | Default Password | Role & Permissions |
| :--- | :--- | :--- | :--- |
| **Sarah Connor** | `admin@acme.corp` | `password123` | **ADMIN** (Full access, employee onboarding, org configuration) |
| **Elena Rostova** | `manager@acme.corp` | `password123` | **MANAGER** (Engineering lead, approves leaves, regularizations, timesheets) |
| **Alex Mercer** | `alex@acme.corp` | `password123` | **EMPLOYEE** (Senior Engineer, ESS attendance clock, leave requests, timesheets) |
| **David Vance** | `hr@acme.corp` | `password123` | **HR_MANAGER** (People Ops lead, workforce records, announcements) |

---

## 🧪 Running Automated Tests

```bash
cd backend
.\.venv\Scripts\python.exe -m pytest tests/test_hrms.py -v
```
All 5 automated test suites pass, verifying health checks, authentication, attendance calculations, leave balance deductions, and project tracking.
