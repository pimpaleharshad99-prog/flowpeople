BEGIN TRANSACTION;
CREATE TABLE alembic_version (
	version_num VARCHAR(32) NOT NULL, 
	CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);
INSERT INTO "alembic_version" VALUES('7ccb2b57bc2b');
CREATE TABLE announcements (
	id INTEGER NOT NULL, 
	company_id INTEGER NOT NULL, 
	author_id INTEGER, 
	title VARCHAR(255) NOT NULL, 
	content TEXT NOT NULL, 
	priority VARCHAR(20), 
	published_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(author_id) REFERENCES users (id) ON DELETE SET NULL
);
INSERT INTO "announcements" VALUES(1,1,1,'FlowPeople Platform Launch & All-Hands Presentation','Welcome to FlowPeople by FlowCraft: People First. Work Smarter. Join us this Thursday at 3:00 PM EST for our quarterly company-wide presentation covering our new workforce management suite.','IMPORTANT','2026-11-02 19:00:28.314790');
INSERT INTO "announcements" VALUES(2,1,2,'FlowCraft Open Enrollment for Health Benefits','Health insurance open enrollment is now live on FlowPeople. Please review your plan selections before the end of the month.','NORMAL','2026-11-02 19:00:28.314800');
CREATE TABLE attendance_punches (
	id INTEGER NOT NULL, 
	attendance_record_id INTEGER NOT NULL, 
	punch_time DATETIME NOT NULL, 
	punch_type VARCHAR(10) NOT NULL, 
	ip_address VARCHAR(50), 
	latitude FLOAT, 
	longitude FLOAT, 
	location_note VARCHAR(255), 
	device VARCHAR(100), 
	verification_method VARCHAR(50), 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(attendance_record_id) REFERENCES attendance_records (id) ON DELETE CASCADE
);
INSERT INTO "attendance_punches" VALUES(1,1,'2026-11-02 09:05:00.248999','IN',NULL,NULL,NULL,'San Francisco HQ - Wi-Fi','Web Browser','FACE','2026-11-02 19:00:28.281190');
CREATE TABLE attendance_records (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	date VARCHAR(20) NOT NULL, 
	shift_id INTEGER, 
	first_check_in DATETIME, 
	last_check_out DATETIME, 
	total_work_minutes INTEGER, 
	total_break_minutes INTEGER, 
	overtime_minutes INTEGER, 
	late_in_minutes INTEGER, 
	early_out_minutes INTEGER, 
	status VARCHAR(50) NOT NULL, 
	is_regularized BOOLEAN, 
	remarks TEXT, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(shift_id) REFERENCES shifts (id) ON DELETE SET NULL
);
INSERT INTO "attendance_records" VALUES(1,3,'2026-11-02',1,'2026-11-02 09:05:00.248999',NULL,150,0,0,5,0,'PRESENT',0,NULL,'2026-11-02 19:00:28.255254','2026-11-02 19:00:28.255265');
INSERT INTO "attendance_records" VALUES(2,5,'2026-11-01',1,'2026-11-01 08:55:00.248999','2026-11-01 18:10:00.248999',495,60,15,0,0,'PRESENT',0,NULL,'2026-11-02 19:00:28.266061','2026-11-02 19:00:28.266069');
CREATE TABLE attendance_regularizations (
	id INTEGER NOT NULL, 
	attendance_record_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	requested_first_in DATETIME NOT NULL, 
	requested_last_out DATETIME NOT NULL, 
	reason TEXT NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	approver_id INTEGER, 
	review_comments TEXT, 
	reviewed_at DATETIME, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(attendance_record_id) REFERENCES attendance_records (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(approver_id) REFERENCES users (id) ON DELETE SET NULL
);
CREATE TABLE audit_logs (
	id INTEGER NOT NULL, 
	company_id INTEGER NOT NULL, 
	user_id INTEGER, 
	entity_name VARCHAR(100) NOT NULL, 
	entity_id INTEGER NOT NULL, 
	action VARCHAR(50) NOT NULL, 
	details TEXT, 
	ip_address VARCHAR(50), 
	created_at DATETIME, 
	PRIMARY KEY (id)
);
CREATE TABLE branches (
	id INTEGER NOT NULL, 
	company_id INTEGER NOT NULL, 
	name VARCHAR(150) NOT NULL, 
	code VARCHAR(50) NOT NULL, 
	address TEXT, 
	city VARCHAR(100), 
	state VARCHAR(100), 
	country VARCHAR(100), 
	postal_code VARCHAR(30), 
	timezone VARCHAR(50), 
	latitude FLOAT, 
	longitude FLOAT, 
	geofence_radius_meters INTEGER, 
	is_geofence_enforced BOOLEAN, 
	is_headquarters BOOLEAN, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
INSERT INTO "branches" VALUES(1,1,'San Francisco Headquarters','SF-HQ','500 Howard Street, Suite 400','San Francisco','CA','United States','94105','America/Los_Angeles',37.7891,-122.3995,200,1,1,'2026-11-02 19:00:23.674257','2026-11-02 19:00:23.674264');
INSERT INTO "branches" VALUES(2,1,'New York Innovation Center','NYC-01','1 World Trade Center, Floor 45','New York','NY','United States','10007','America/New_York',40.713,-74.0132,150,1,0,'2026-11-02 19:00:23.674268','2026-11-02 19:00:23.674271');
INSERT INTO "branches" VALUES(3,1,'London Engineering Hub','LDN-01','100 Bishopsgate','London','Greater London','United Kingdom','EC2N 4AG','Europe/London',51.5152,-0.0822,180,1,0,'2026-11-02 19:00:23.674273','2026-11-02 19:00:23.674275');
CREATE TABLE companies (
	id INTEGER NOT NULL, 
	uuid VARCHAR(36), 
	name VARCHAR(200) NOT NULL, 
	code VARCHAR(50) NOT NULL, 
	slug VARCHAR(100), 
	brand_name VARCHAR(200), 
	owner_user_id INTEGER, 
	logo_url VARCHAR(500), 
	domain VARCHAR(100), 
	timezone VARCHAR(50), 
	currency VARCHAR(10), 
	contact_email VARCHAR(150), 
	phone VARCHAR(50), 
	address TEXT, 
	industry VARCHAR(100), 
	company_size VARCHAR(50), 
	status VARCHAR(50), 
	is_active BOOLEAN, 
	subscription_plan_id VARCHAR(50), 
	subscription_status VARCHAR(50), 
	max_employees INTEGER, 
	max_admins INTEGER, 
	trial_ends_at DATETIME, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id)
);
INSERT INTO "companies" VALUES(1,'9fb94b62-276a-4d83-a4d4-35ad0b98f0b1','FlowCraft Technologies Inc.','FLOWCRAFT',NULL,NULL,NULL,'https://images.unsplash.com/photo-1542744094-24638eff58bb?w=128&auto=format&fit=crop&q=80','flowcraft.io','America/New_York','USD',NULL,NULL,NULL,NULL,NULL,'ACTIVE',1,'free_trial','TRIALING',10,1,NULL,'2026-11-02 19:00:23.666203','2026-11-02 19:00:23.666210');
CREATE TABLE company_settings (
	id INTEGER NOT NULL, 
	company_id INTEGER NOT NULL, 
	work_hours_per_day FLOAT, 
	working_days VARCHAR(100), 
	leave_year_start_month INTEGER, 
	auto_approval_regularization BOOLEAN, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	UNIQUE (company_id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
INSERT INTO "company_settings" VALUES(1,1,8.0,'Monday,Tuesday,Wednesday,Thursday,Friday',1,0,'2026-11-02 19:00:23.678240');
CREATE TABLE departments (
	id INTEGER NOT NULL, 
	company_id INTEGER NOT NULL, 
	name VARCHAR(150) NOT NULL, 
	code VARCHAR(50) NOT NULL, 
	description TEXT, 
	parent_id INTEGER, 
	head_user_id INTEGER, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(parent_id) REFERENCES departments (id) ON DELETE SET NULL
);
INSERT INTO "departments" VALUES(1,1,'Engineering','ENG','Software Engineering & Cloud Infrastructure',NULL,NULL,'2026-11-02 19:00:23.682199');
INSERT INTO "departments" VALUES(2,1,'People & Culture (HR)','HR','Talent Acquisition & Employee Happiness',NULL,NULL,'2026-11-02 19:00:23.682204');
INSERT INTO "departments" VALUES(3,1,'Product & Design','PROD','UI/UX & Product Strategy',NULL,NULL,'2026-11-02 19:00:23.682206');
INSERT INTO "departments" VALUES(4,1,'Sales & Growth','SALES','Global Enterprise Sales',NULL,NULL,'2026-11-02 19:00:23.682207');
CREATE TABLE designations (
	id INTEGER NOT NULL, 
	company_id INTEGER NOT NULL, 
	department_id INTEGER, 
	name VARCHAR(150) NOT NULL, 
	code VARCHAR(50) NOT NULL, 
	description TEXT, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(department_id) REFERENCES departments (id) ON DELETE CASCADE
);
INSERT INTO "designations" VALUES(1,1,1,'VP of Engineering','VP-ENG',NULL,'2026-11-02 19:00:23.685713');
INSERT INTO "designations" VALUES(2,1,1,'Engineering Manager','ENG-MGR',NULL,'2026-11-02 19:00:23.685718');
INSERT INTO "designations" VALUES(3,1,1,'Lead Fullstack Engineer','SR-ENG',NULL,'2026-11-02 19:00:23.685720');
INSERT INTO "designations" VALUES(4,1,1,'Senior Frontend Specialist','FE-ENG',NULL,'2026-11-02 19:00:23.685721');
INSERT INTO "designations" VALUES(5,1,2,'HR Director','HR-DIR',NULL,'2026-11-02 19:00:23.685722');
INSERT INTO "designations" VALUES(6,1,2,'People Operations Lead','PO-LEAD',NULL,'2026-11-02 19:00:23.685723');
INSERT INTO "designations" VALUES(7,1,3,'Principal Product Designer','PR-DES',NULL,'2026-11-02 19:00:23.685725');
INSERT INTO "designations" VALUES(8,1,4,'Enterprise Account Executive','SR-AE',NULL,'2026-11-02 19:00:23.685726');
CREATE TABLE employee_documents (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	category VARCHAR(100) NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	file_name VARCHAR(255) NOT NULL, 
	file_path VARCHAR(500) NOT NULL, 
	file_size_kb INTEGER, 
	uploaded_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE TABLE employee_salary_structures (
	id INTEGER NOT NULL, 
	company_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	ctc_annual FLOAT NOT NULL, 
	basic_monthly FLOAT NOT NULL, 
	hra_monthly FLOAT NOT NULL, 
	allowances_monthly FLOAT, 
	pf_deduction_monthly FLOAT, 
	professional_tax_monthly FLOAT, 
	net_monthly_base FLOAT NOT NULL, 
	effective_from VARCHAR(10) NOT NULL, 
	is_active BOOLEAN, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE TABLE face_enrollments (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	consent_given BOOLEAN NOT NULL, 
	consent_timestamp DATETIME, 
	face_template TEXT NOT NULL, 
	template_version VARCHAR(50), 
	status VARCHAR(50) NOT NULL, 
	quality_score FLOAT, 
	liveness_verified BOOLEAN, 
	enrolled_at DATETIME, 
	updated_at DATETIME, 
	revoked_at DATETIME, 
	revoked_by_id INTEGER, 
	PRIMARY KEY (id), 
	UNIQUE (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(revoked_by_id) REFERENCES users (id) ON DELETE SET NULL
);
INSERT INTO "face_enrollments" VALUES(1,1,1,'2026-09-03 19:00:28.294084','[-0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0]','v2.0-facenet-norm','VERIFIED',0.96,1,'2026-09-03 19:00:28.294084','2026-09-03 19:00:28.294084',NULL,NULL);
INSERT INTO "face_enrollments" VALUES(2,2,1,'2026-09-03 19:00:28.294084','[-0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0]','v2.0-facenet-norm','VERIFIED',0.96,1,'2026-09-03 19:00:28.294084','2026-09-03 19:00:28.294084',NULL,NULL);
INSERT INTO "face_enrollments" VALUES(3,3,1,'2026-09-03 19:00:28.294084','[-0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0]','v2.0-facenet-norm','VERIFIED',0.96,1,'2026-09-03 19:00:28.294084','2026-09-03 19:00:28.294084',NULL,NULL);
INSERT INTO "face_enrollments" VALUES(4,4,1,'2026-09-03 19:00:28.294084','[-0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0]','v2.0-facenet-norm','VERIFIED',0.96,1,'2026-09-03 19:00:28.294084','2026-09-03 19:00:28.294084',NULL,NULL);
INSERT INTO "face_enrollments" VALUES(5,5,1,'2026-09-03 19:00:28.294084','[-0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0]','v2.0-facenet-norm','VERIFIED',0.96,1,'2026-09-03 19:00:28.294084','2026-09-03 19:00:28.294084',NULL,NULL);
INSERT INTO "face_enrollments" VALUES(6,6,1,'2026-09-03 19:00:28.294084','[-0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0]','v2.0-facenet-norm','VERIFIED',0.96,1,'2026-09-03 19:00:28.294084','2026-09-03 19:00:28.294084',NULL,NULL);
INSERT INTO "face_enrollments" VALUES(7,7,1,'2026-09-03 19:00:28.294084','[-0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0.0]','v2.0-facenet-norm','VERIFIED',0.96,1,'2026-09-03 19:00:28.294084','2026-09-03 19:00:28.294084',NULL,NULL);
CREATE TABLE face_verification_logs (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	attempt_type VARCHAR(50) NOT NULL, 
	status VARCHAR(50) NOT NULL, 
	confidence_score FLOAT, 
	liveness_score FLOAT, 
	failure_reason VARCHAR(255), 
	ip_address VARCHAR(100), 
	device_info VARCHAR(255), 
	timestamp DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
INSERT INTO "face_verification_logs" VALUES(1,1,'CHECK_IN','SUCCESS',0.94,0.92,NULL,'127.0.0.1','FlowPeople Face ID Terminal','2026-11-02 16:00:28.294084');
INSERT INTO "face_verification_logs" VALUES(2,2,'CHECK_IN','SUCCESS',0.94,0.92,NULL,'127.0.0.1','FlowPeople Face ID Terminal','2026-11-02 16:00:28.294084');
INSERT INTO "face_verification_logs" VALUES(3,3,'CHECK_IN','SUCCESS',0.94,0.92,NULL,'127.0.0.1','FlowPeople Face ID Terminal','2026-11-02 16:00:28.294084');
INSERT INTO "face_verification_logs" VALUES(4,4,'CHECK_IN','SUCCESS',0.94,0.92,NULL,'127.0.0.1','FlowPeople Face ID Terminal','2026-11-02 16:00:28.294084');
INSERT INTO "face_verification_logs" VALUES(5,5,'CHECK_IN','SUCCESS',0.94,0.92,NULL,'127.0.0.1','FlowPeople Face ID Terminal','2026-11-02 16:00:28.294084');
INSERT INTO "face_verification_logs" VALUES(6,6,'CHECK_IN','SUCCESS',0.94,0.92,NULL,'127.0.0.1','FlowPeople Face ID Terminal','2026-11-02 16:00:28.294084');
INSERT INTO "face_verification_logs" VALUES(7,7,'CHECK_IN','SUCCESS',0.94,0.92,NULL,'127.0.0.1','FlowPeople Face ID Terminal','2026-11-02 16:00:28.294084');
CREATE TABLE fingerprint_enrollments (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	credential_id VARCHAR(255) NOT NULL, 
	public_key TEXT, 
	device_name VARCHAR(100), 
	counter INTEGER, 
	status VARCHAR(50) NOT NULL, 
	enrolled_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	UNIQUE (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE TABLE goals (
	id INTEGER NOT NULL, 
	company_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	description TEXT, 
	kpi_metric VARCHAR(150), 
	target_value FLOAT, 
	current_value FLOAT, 
	unit VARCHAR(50), 
	status VARCHAR(50) NOT NULL, 
	due_date VARCHAR(20) NOT NULL, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
INSERT INTO "goals" VALUES(1,1,4,'Implement Face ID Anti-Spoof Biometric Pipeline','Build real-time camera capture, anti-spoof liveness challenge and server-side facial feature matching.','Verification Accuracy & Latency',100.0,92.0,'%','IN_PROGRESS','2026-11-30','2026-11-02 19:00:28.347745','2026-11-02 19:00:28.347758');
INSERT INTO "goals" VALUES(2,1,4,'Complete Super Admin & Multi-Tenant Portal Architecture','Provide company management, system health observability and cross-tenant auditing.','Portals Delivered',100.0,100.0,'%','ACHIEVED','2026-10-31','2026-11-02 19:00:28.347761','2026-11-02 19:00:28.347763');
INSERT INTO "goals" VALUES(3,1,3,'Maintain 99.5% Sprint Delivery & Zero High Severity Defects','Lead engineering team sprint planning, code review rigor, and architectural compliance.','Sprint Velocity Index',100.0,96.0,'%','IN_PROGRESS','2026-12-31','2026-11-02 19:00:28.347766','2026-11-02 19:00:28.347768');
CREATE TABLE holidays (
	id INTEGER NOT NULL, 
	company_id INTEGER NOT NULL, 
	name VARCHAR(150) NOT NULL, 
	holiday_date VARCHAR(20) NOT NULL, 
	is_optional BOOLEAN, 
	description TEXT, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
INSERT INTO "holidays" VALUES(1,1,'New Year''s Day','2026-01-01',0,'Global Holiday','2026-11-02 19:00:23.699336');
INSERT INTO "holidays" VALUES(2,1,'Memorial Day','2026-05-25',0,'Public Holiday','2026-11-02 19:00:23.699341');
INSERT INTO "holidays" VALUES(3,1,'Independence Day','2026-07-04',0,'National Holiday','2026-11-02 19:00:23.699343');
INSERT INTO "holidays" VALUES(4,1,'Labor Day','2026-09-07',0,'Federal Holiday','2026-11-02 19:00:23.699344');
INSERT INTO "holidays" VALUES(5,1,'Thanksgiving Day','2026-11-26',0,'Annual Celebration','2026-11-02 19:00:23.699346');
INSERT INTO "holidays" VALUES(6,1,'Christmas Day','2026-12-25',0,'Winter Holiday','2026-11-02 19:00:23.699348');
CREATE TABLE hr_tickets (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	category VARCHAR(100) NOT NULL, 
	subject VARCHAR(255) NOT NULL, 
	description TEXT NOT NULL, 
	priority VARCHAR(20), 
	status VARCHAR(20), 
	assigned_to_id INTEGER, 
	resolution_notes TEXT, 
	created_at DATETIME, 
	resolved_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(assigned_to_id) REFERENCES users (id) ON DELETE SET NULL
);
INSERT INTO "hr_tickets" VALUES(1,4,'IT Equipment','Dual 4K Monitor Arm and Ergonomic Keyboard Request','Requesting dual monitor desk mounts for local workstation setup.','MEDIUM','RESOLVED',2,'Approved and shipped by IT Operations.','2026-11-02 19:00:28.319541','2026-10-23 19:00:28.294084');
INSERT INTO "hr_tickets" VALUES(2,4,'Benefits','International Health Insurance Travel Endorsement','Need insurance certification for upcoming tech conference in Europe.','HIGH','IN_PROGRESS',2,NULL,'2026-11-02 19:00:28.319550',NULL);
CREATE TABLE leave_approvals (
	id INTEGER NOT NULL, 
	leave_request_id INTEGER NOT NULL, 
	approver_id INTEGER NOT NULL, 
	tier_level INTEGER, 
	status VARCHAR(30) NOT NULL, 
	comments TEXT, 
	reviewed_at DATETIME, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(leave_request_id) REFERENCES leave_requests (id) ON DELETE CASCADE, 
	FOREIGN KEY(approver_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE TABLE leave_balances (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	leave_type_id INTEGER NOT NULL, 
	year INTEGER NOT NULL, 
	allocated FLOAT, 
	used FLOAT, 
	pending_approval FLOAT, 
	balance FLOAT, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(leave_type_id) REFERENCES leave_types (id) ON DELETE CASCADE
);
INSERT INTO "leave_balances" VALUES(1,1,1,2026,12.0,2.0,0.0,10.0,'2026-11-02 19:00:28.238227');
INSERT INTO "leave_balances" VALUES(2,1,2,2026,10.0,1.0,0.0,9.0,'2026-11-02 19:00:28.238236');
INSERT INTO "leave_balances" VALUES(3,1,3,2026,15.0,3.0,0.0,12.0,'2026-11-02 19:00:28.238239');
INSERT INTO "leave_balances" VALUES(4,2,1,2026,12.0,2.0,0.0,10.0,'2026-11-02 19:00:28.238241');
INSERT INTO "leave_balances" VALUES(5,2,2,2026,10.0,1.0,0.0,9.0,'2026-11-02 19:00:28.238244');
INSERT INTO "leave_balances" VALUES(6,2,3,2026,15.0,3.0,0.0,12.0,'2026-11-02 19:00:28.238248');
INSERT INTO "leave_balances" VALUES(7,3,1,2026,12.0,2.0,0.0,10.0,'2026-11-02 19:00:28.238250');
INSERT INTO "leave_balances" VALUES(8,3,2,2026,10.0,1.0,0.0,9.0,'2026-11-02 19:00:28.238253');
INSERT INTO "leave_balances" VALUES(9,3,3,2026,15.0,3.0,0.0,12.0,'2026-11-02 19:00:28.238255');
INSERT INTO "leave_balances" VALUES(10,4,1,2026,12.0,2.0,0.0,10.0,'2026-11-02 19:00:28.238257');
INSERT INTO "leave_balances" VALUES(11,4,2,2026,10.0,1.0,0.0,9.0,'2026-11-02 19:00:28.238259');
INSERT INTO "leave_balances" VALUES(12,4,3,2026,15.0,3.0,0.0,12.0,'2026-11-02 19:00:28.238262');
INSERT INTO "leave_balances" VALUES(13,5,1,2026,12.0,2.0,0.0,10.0,'2026-11-02 19:00:28.238263');
INSERT INTO "leave_balances" VALUES(14,5,2,2026,10.0,1.0,0.0,9.0,'2026-11-02 19:00:28.238266');
INSERT INTO "leave_balances" VALUES(15,5,3,2026,15.0,3.0,0.0,12.0,'2026-11-02 19:00:28.238268');
INSERT INTO "leave_balances" VALUES(16,6,1,2026,12.0,2.0,0.0,10.0,'2026-11-02 19:00:28.238270');
INSERT INTO "leave_balances" VALUES(17,6,2,2026,10.0,1.0,0.0,9.0,'2026-11-02 19:00:28.238272');
INSERT INTO "leave_balances" VALUES(18,6,3,2026,15.0,3.0,0.0,12.0,'2026-11-02 19:00:28.238275');
INSERT INTO "leave_balances" VALUES(19,7,1,2026,12.0,2.0,0.0,10.0,'2026-11-02 19:00:28.238277');
INSERT INTO "leave_balances" VALUES(20,7,2,2026,10.0,1.0,0.0,9.0,'2026-11-02 19:00:28.238279');
INSERT INTO "leave_balances" VALUES(21,7,3,2026,15.0,3.0,0.0,12.0,'2026-11-02 19:00:28.238282');
CREATE TABLE leave_requests (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	leave_type_id INTEGER NOT NULL, 
	from_date VARCHAR(20) NOT NULL, 
	to_date VARCHAR(20) NOT NULL, 
	day_count FLOAT NOT NULL, 
	is_half_day BOOLEAN, 
	half_day_session VARCHAR(20), 
	reason TEXT NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	document_url VARCHAR(500), 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(leave_type_id) REFERENCES leave_types (id) ON DELETE CASCADE
);
INSERT INTO "leave_requests" VALUES(1,4,1,'2026-11-07','2026-11-08',2.0,0,'NONE','Attending family gathering in Boston','PENDING',NULL,'2026-11-02 19:00:28.271311','2026-11-02 19:00:28.271321');
INSERT INTO "leave_requests" VALUES(2,5,3,'2026-10-23','2026-10-25',3.0,0,'NONE','Annual vacation trip','APPROVED',NULL,'2026-11-02 19:00:28.271325','2026-11-02 19:00:28.271327');
CREATE TABLE leave_types (
	id INTEGER NOT NULL, 
	company_id INTEGER NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	code VARCHAR(50) NOT NULL, 
	annual_quota FLOAT, 
	accrual_frequency VARCHAR(30), 
	carry_forward_limit FLOAT, 
	allow_negative BOOLEAN, 
	requires_approval BOOLEAN, 
	color VARCHAR(20), 
	description TEXT, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
INSERT INTO "leave_types" VALUES(1,1,'Casual Leave','CL',12.0,'ANNUAL',5.0,0,1,'#10B981','General planned leaves','2026-11-02 19:00:23.701986');
INSERT INTO "leave_types" VALUES(2,1,'Sick Leave','SL',10.0,'ANNUAL',5.0,0,1,'#EF4444','Medical leave','2026-11-02 19:00:23.701992');
INSERT INTO "leave_types" VALUES(3,1,'Privilege / Earned Leave','PL',15.0,'ANNUAL',10.0,0,1,'#3B82F6','Annual paid vacation','2026-11-02 19:00:23.703844');
INSERT INTO "leave_types" VALUES(4,1,'Parental / Maternity Leave','PAR',30.0,'ANNUAL',5.0,0,1,'#8B5CF6','Parental care leave','2026-11-02 19:00:23.705385');
CREATE TABLE lifecycle_records (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	stage VARCHAR(50) NOT NULL, 
	effective_date VARCHAR(20) NOT NULL, 
	notes TEXT, 
	created_by_id INTEGER, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL
);
INSERT INTO "lifecycle_records" VALUES(1,4,'ONBOARDING','2025-01-15','Initial joining as Lead Fullstack Engineer',2,'2026-11-02 19:00:28.330313');
INSERT INTO "lifecycle_records" VALUES(2,4,'CONFIRMED','2025-04-15','Successfully completed 90-day probation period with outstanding marks',2,'2026-11-02 19:00:28.330325');
CREATE TABLE notifications (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	message TEXT NOT NULL, 
	type VARCHAR(50), 
	link VARCHAR(255), 
	is_read BOOLEAN, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE TABLE onboarding_tasks (
	id INTEGER NOT NULL, 
	company_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	category VARCHAR(100) NOT NULL, 
	is_completed BOOLEAN NOT NULL, 
	completed_at DATETIME, 
	due_date VARCHAR(20), 
	notes TEXT, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
INSERT INTO "onboarding_tasks" VALUES(1,1,4,'Verify National Identity and Tax Documents','DOCUMENTS',1,'2026-04-16 19:00:28.294084','2025-01-20',NULL,'2026-11-02 19:00:28.336590');
INSERT INTO "onboarding_tasks" VALUES(2,1,4,'Biometric Face ID Enrollment & Camera Test','IT_SETUP',1,'2026-04-17 19:00:28.294084','2025-01-22',NULL,'2026-11-02 19:00:28.336598');
INSERT INTO "onboarding_tasks" VALUES(3,1,4,'Engineering Security & GDPR Compliance Orientation','TRAINING',1,'2026-04-26 19:00:28.294084','2025-01-30',NULL,'2026-11-02 19:00:28.336602');
INSERT INTO "onboarding_tasks" VALUES(4,1,4,'Quarterly Mentorship Sync & 360 Feedback','ORIENTATION',0,NULL,'2026-12-15','Scheduled with Elena Rostova','2026-11-02 19:00:28.336604');
CREATE TABLE organization_drive_uploads (
	id INTEGER NOT NULL, 
	uuid VARCHAR(36), 
	company_id INTEGER NOT NULL, 
	organization_uuid VARCHAR(36), 
	report_type VARCHAR(100) NOT NULL, 
	file_name VARCHAR(255) NOT NULL, 
	file_size_bytes INTEGER, 
	mime_type VARCHAR(100), 
	drive_file_id VARCHAR(255), 
	drive_folder_id VARCHAR(255), 
	drive_web_view_link VARCHAR(1000), 
	upload_status VARCHAR(50), 
	retry_count INTEGER, 
	error_message TEXT, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
CREATE TABLE organization_integrations (
	id INTEGER NOT NULL, 
	uuid VARCHAR(36), 
	company_id INTEGER NOT NULL, 
	organization_uuid VARCHAR(36), 
	provider VARCHAR(50) NOT NULL, 
	connected_account_email VARCHAR(255), 
	encrypted_refresh_token TEXT, 
	access_token TEXT, 
	access_token_expiry DATETIME, 
	drive_root_folder_id VARCHAR(255), 
	drive_company_folder_id VARCHAR(255), 
	drive_attendance_folder_id VARCHAR(255), 
	drive_employees_folder_id VARCHAR(255), 
	drive_payroll_folder_id VARCHAR(255), 
	drive_leave_folder_id VARCHAR(255), 
	connection_status VARCHAR(50) NOT NULL, 
	auto_attendance_reports BOOLEAN, 
	auto_monthly_reports BOOLEAN, 
	last_successful_sync DATETIME, 
	last_error TEXT, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_org_integration_provider UNIQUE (company_id, provider), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
CREATE TABLE organization_members (
	id INTEGER NOT NULL, 
	uuid VARCHAR(36), 
	company_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	role VARCHAR(50) NOT NULL, 
	status VARCHAR(50) NOT NULL, 
	joined_at DATETIME, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_company_user_member UNIQUE (company_id, user_id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE TABLE payment_transactions (
	id INTEGER NOT NULL, 
	company_id INTEGER NOT NULL, 
	subscription_id INTEGER, 
	amount FLOAT NOT NULL, 
	currency VARCHAR(10), 
	status VARCHAR(30) NOT NULL, 
	provider VARCHAR(50), 
	transaction_reference VARCHAR(100) NOT NULL, 
	invoice_number VARCHAR(100) NOT NULL, 
	billing_name VARCHAR(150), 
	billing_email VARCHAR(150), 
	notes TEXT, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(subscription_id) REFERENCES subscriptions (id) ON DELETE SET NULL
);
CREATE TABLE payroll_periods (
	id INTEGER NOT NULL, 
	company_id INTEGER NOT NULL, 
	month VARCHAR(7) NOT NULL, 
	period_start VARCHAR(10) NOT NULL, 
	period_end VARCHAR(10) NOT NULL, 
	status VARCHAR(20), 
	total_gross FLOAT, 
	total_deductions FLOAT, 
	total_net FLOAT, 
	employee_count INTEGER, 
	processed_by_id INTEGER, 
	approved_by_id INTEGER, 
	notes TEXT, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(processed_by_id) REFERENCES users (id), 
	FOREIGN KEY(approved_by_id) REFERENCES users (id)
);
CREATE TABLE payslips (
	id INTEGER NOT NULL, 
	company_id INTEGER NOT NULL, 
	payroll_period_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	working_days FLOAT, 
	days_present FLOAT, 
	paid_leaves FLOAT, 
	unpaid_leaves FLOAT, 
	payable_days FLOAT, 
	overtime_hours FLOAT, 
	overtime_pay FLOAT, 
	basic_salary FLOAT, 
	hra FLOAT, 
	allowances FLOAT, 
	gross_earnings FLOAT, 
	pf_deduction FLOAT, 
	tax_deduction FLOAT, 
	other_deductions FLOAT, 
	total_deductions FLOAT, 
	net_salary FLOAT, 
	payment_status VARCHAR(20), 
	payment_date VARCHAR(10), 
	notes TEXT, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(payroll_period_id) REFERENCES payroll_periods (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE TABLE performance_reviews (
	id INTEGER NOT NULL, 
	company_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	reviewer_id INTEGER, 
	cycle_name VARCHAR(100) NOT NULL, 
	self_assessment TEXT, 
	manager_feedback TEXT, 
	rating FLOAT, 
	status VARCHAR(50) NOT NULL, 
	completed_at DATETIME, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(reviewer_id) REFERENCES users (id) ON DELETE SET NULL
);
INSERT INTO "performance_reviews" VALUES(1,1,4,3,'Q3-Q4 2026 Bi-Annual Appraisal','Delivered core HRMS modules, time tracker, and designed the real-time biometric verification pipeline ahead of schedule.','Exceptional work quality, technical autonomy, and leadership across frontend and backend implementations.',4.9,'COMPLETED','2026-10-28 19:00:28.294084','2026-11-02 19:00:28.351663');
CREATE TABLE platform_admins (
	id INTEGER NOT NULL, 
	user_id VARCHAR(64) NOT NULL, 
	role VARCHAR(50) NOT NULL, 
	created_at DATETIME, 
	PRIMARY KEY (id)
);
CREATE TABLE project_members (
	id INTEGER NOT NULL, 
	project_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	role_in_project VARCHAR(100), 
	assigned_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE TABLE projects (
	id INTEGER NOT NULL, 
	company_id INTEGER NOT NULL, 
	name VARCHAR(150) NOT NULL, 
	code VARCHAR(50) NOT NULL, 
	client_name VARCHAR(150), 
	description TEXT, 
	budget_hours FLOAT, 
	status VARCHAR(30), 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
INSERT INTO "projects" VALUES(1,1,'FlowPeople Core Platform Launch','FLOW-2026','FlowCraft Ecosystem',NULL,500.0,'ACTIVE','2026-11-02 19:00:28.275695');
INSERT INTO "projects" VALUES(2,1,'Mobile Attendance & Geofencing Terminal','FLOW-MOB','FlowCraft Mobile Labs',NULL,350.0,'ACTIVE','2026-11-02 19:00:28.275708');
CREATE TABLE salary_components (
	id INTEGER NOT NULL, 
	company_id INTEGER NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	component_type VARCHAR(20), 
	is_taxable BOOLEAN, 
	is_statutory BOOLEAN, 
	default_amount FLOAT, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
CREATE TABLE shift_assignments (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	shift_id INTEGER NOT NULL, 
	start_date VARCHAR(20) NOT NULL, 
	end_date VARCHAR(20), 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(shift_id) REFERENCES shifts (id) ON DELETE CASCADE
);
INSERT INTO "shift_assignments" VALUES(1,1,1,'2026-01-01',NULL,'2026-11-02 19:00:28.245958');
INSERT INTO "shift_assignments" VALUES(2,2,1,'2026-01-01',NULL,'2026-11-02 19:00:28.245967');
INSERT INTO "shift_assignments" VALUES(3,3,1,'2026-01-01',NULL,'2026-11-02 19:00:28.245970');
INSERT INTO "shift_assignments" VALUES(4,4,1,'2026-01-01',NULL,'2026-11-02 19:00:28.245972');
INSERT INTO "shift_assignments" VALUES(5,5,1,'2026-01-01',NULL,'2026-11-02 19:00:28.245974');
INSERT INTO "shift_assignments" VALUES(6,6,1,'2026-01-01',NULL,'2026-11-02 19:00:28.245976');
INSERT INTO "shift_assignments" VALUES(7,7,1,'2026-01-01',NULL,'2026-11-02 19:00:28.245978');
CREATE TABLE shifts (
	id INTEGER NOT NULL, 
	company_id INTEGER NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	code VARCHAR(50) NOT NULL, 
	start_time VARCHAR(10) NOT NULL, 
	end_time VARCHAR(10) NOT NULL, 
	expected_work_hours INTEGER, 
	break_duration_mins INTEGER, 
	grace_period_mins INTEGER, 
	early_exit_allowance_mins INTEGER, 
	half_day_threshold_mins INTEGER, 
	is_night_shift BOOLEAN, 
	is_default BOOLEAN, 
	color VARCHAR(20), 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);
INSERT INTO "shifts" VALUES(1,1,'General Day Shift','GEN-01','09:00','18:00',480,60,15,15,240,0,1,'#3B82F6','2026-11-02 19:00:23.691709');
INSERT INTO "shifts" VALUES(2,1,'Early Bird Shift','EARLY-02','07:00','16:00',480,60,15,15,240,0,0,'#10B981','2026-11-02 19:00:23.694115');
INSERT INTO "shifts" VALUES(3,1,'Night Owl Shift','NIGHT-03','20:00','05:00',480,60,15,15,240,1,0,'#6366F1','2026-11-02 19:00:23.695549');
CREATE TABLE subscription_plans (
	id VARCHAR(50) NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	tier VARCHAR(50) NOT NULL, 
	description TEXT, 
	price_monthly_inr INTEGER, 
	price_annual_inr INTEGER, 
	price_monthly_usd FLOAT, 
	price_annual_usd FLOAT, 
	max_employees INTEGER, 
	max_hr_admins INTEGER, 
	face_attendance_enabled BOOLEAN, 
	fingerprint_enabled BOOLEAN, 
	payroll_enabled BOOLEAN, 
	advanced_reports_enabled BOOLEAN, 
	storage_limit_gb INTEGER, 
	support_level VARCHAR(50), 
	is_active BOOLEAN, 
	created_at DATETIME, 
	PRIMARY KEY (id)
);
CREATE TABLE subscriptions (
	id INTEGER NOT NULL, 
	company_id INTEGER NOT NULL, 
	plan_id VARCHAR(50) NOT NULL, 
	status VARCHAR(50) NOT NULL, 
	billing_cycle VARCHAR(20) NOT NULL, 
	current_period_start DATETIME, 
	current_period_end DATETIME, 
	trial_ends_at DATETIME, 
	grace_period_until DATETIME, 
	cancel_at_period_end BOOLEAN, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(plan_id) REFERENCES subscription_plans (id)
);
CREATE TABLE tasks (
	id INTEGER NOT NULL, 
	project_id INTEGER NOT NULL, 
	name VARCHAR(150) NOT NULL, 
	description TEXT, 
	billable BOOLEAN, 
	estimated_hours FLOAT, 
	status VARCHAR(30), 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
);
INSERT INTO "tasks" VALUES(1,1,'Frontend UI & Component Library',NULL,1,120.0,'IN_PROGRESS','2026-11-02 19:00:28.290683');
INSERT INTO "tasks" VALUES(2,1,'REST API & Database Engine',NULL,1,140.0,'IN_PROGRESS','2026-11-02 19:00:28.290695');
INSERT INTO "tasks" VALUES(3,2,'GPS & Geofencing SDK',NULL,1,80.0,'IN_PROGRESS','2026-11-02 19:00:28.290699');
CREATE TABLE time_logs (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	project_id INTEGER NOT NULL, 
	task_id INTEGER NOT NULL, 
	timesheet_id INTEGER, 
	log_date VARCHAR(20) NOT NULL, 
	hours FLOAT NOT NULL, 
	description TEXT, 
	is_billable BOOLEAN, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE, 
	FOREIGN KEY(task_id) REFERENCES tasks (id) ON DELETE CASCADE, 
	FOREIGN KEY(timesheet_id) REFERENCES timesheets (id) ON DELETE SET NULL
);
INSERT INTO "time_logs" VALUES(1,4,1,2,NULL,'2026-11-01',6.5,'Implemented Attendance punch calculation service & shift matching',1,'2026-11-02 19:00:28.356980');
INSERT INTO "time_logs" VALUES(2,4,1,1,NULL,'2026-11-01',2.0,'Built live timer widget and attendance clock component',1,'2026-11-02 19:00:28.356989');
CREATE TABLE timesheets (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	period_start VARCHAR(20) NOT NULL, 
	period_end VARCHAR(20) NOT NULL, 
	total_hours FLOAT, 
	status VARCHAR(30), 
	approver_id INTEGER, 
	submitted_at DATETIME, 
	reviewed_at DATETIME, 
	review_comments TEXT, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(approver_id) REFERENCES users (id) ON DELETE SET NULL
);
CREATE TABLE users (
	id INTEGER NOT NULL, 
	uuid VARCHAR(36), 
	company_id INTEGER NOT NULL, 
	employee_code VARCHAR(50) NOT NULL, 
	email VARCHAR(150) NOT NULL, 
	hashed_password VARCHAR(255) NOT NULL, 
	first_name VARCHAR(100) NOT NULL, 
	last_name VARCHAR(100) NOT NULL, 
	avatar_url VARCHAR(500), 
	phone VARCHAR(30), 
	gender VARCHAR(20), 
	date_of_birth VARCHAR(20), 
	blood_group VARCHAR(10), 
	role VARCHAR(50) NOT NULL, 
	is_platform_owner BOOLEAN, 
	status VARCHAR(50) NOT NULL, 
	employment_type VARCHAR(50) NOT NULL, 
	date_of_joining VARCHAR(20) NOT NULL, 
	confirmation_date VARCHAR(20), 
	branch_id INTEGER, 
	department_id INTEGER, 
	designation_id INTEGER, 
	manager_id INTEGER, 
	shift_id INTEGER, 
	created_by_id INTEGER, 
	auth_user_id VARCHAR(255), 
	invitation_token VARCHAR(255), 
	invited_at DATETIME, 
	work_location VARCHAR(150), 
	address TEXT, 
	emergency_contact_name VARCHAR(100), 
	emergency_contact_phone VARCHAR(50), 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE, 
	FOREIGN KEY(branch_id) REFERENCES branches (id) ON DELETE SET NULL, 
	FOREIGN KEY(department_id) REFERENCES departments (id) ON DELETE SET NULL, 
	FOREIGN KEY(designation_id) REFERENCES designations (id) ON DELETE SET NULL, 
	FOREIGN KEY(manager_id) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(shift_id) REFERENCES shifts (id) ON DELETE SET NULL, 
	FOREIGN KEY(created_by_id) REFERENCES users (id) ON DELETE SET NULL
);
INSERT INTO "users" VALUES(1,'7db3b91e-d590-4269-965f-e0e04d1a28ed',1,'EMP-001','admin@acme.corp','$2b$12$WL1kSA2yieLQeTZ5DU7VDeC0gFNIglV6vBVJycytYU6CUBI9wOXKq','Sarah','Connor','https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80','+1 (555) 019-2831','Female',NULL,NULL,'SUPER_ADMIN',1,'ACTIVE','FULL_TIME','2021-01-15',NULL,1,2,5,NULL,1,NULL,NULL,NULL,NULL,'Headquarters',NULL,NULL,NULL,'2026-11-02 19:00:28.174982','2026-11-02 19:00:28.175015');
INSERT INTO "users" VALUES(2,'c5cb38b8-4d69-4050-9e27-53cce1a190fa',1,'EMP-002','hr@acme.corp','$2b$12$EWLsorJq9IfwLTsfaS0mW.jYfkPzzRs00OahAQ1iyKuWnxGY/SDH2','David','Vance','https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80','+1 (555) 012-4411','Male',NULL,NULL,'HR_ADMIN',0,'ACTIVE','FULL_TIME','2022-08-01',NULL,1,2,6,1,1,NULL,NULL,NULL,NULL,'Headquarters',NULL,NULL,NULL,'2026-11-02 19:00:28.185399','2026-11-02 19:00:28.185406');
INSERT INTO "users" VALUES(3,'525d6d6e-d6bd-4418-a058-e21e43352f76',1,'EMP-003','manager@acme.corp','$2b$12$fHS.DHZXWDKguHir572IT.qhfQWTOKyZWkzj/JZhGR3e7UwkU3Bt6','Elena','Rostova','https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80','+1 (555) 018-7294','Female',NULL,NULL,'MANAGER',0,'ACTIVE','FULL_TIME','2022-03-01',NULL,1,1,2,1,1,NULL,NULL,NULL,NULL,'Headquarters',NULL,NULL,NULL,'2026-11-02 19:00:28.190567','2026-11-02 19:00:28.190585');
INSERT INTO "users" VALUES(4,'a05a87d6-2d8c-480a-98c2-469891d39860',1,'EMP-004','alex@acme.corp','$2b$12$BDzC2s6uIPYvbzSNcKpBcumxCW/ZY7DVSr9rZqRe2ZY/0JizF7xva','Alex','Mercer','https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80','+1 (555) 014-9988','Male',NULL,NULL,'EMPLOYEE',0,'ACTIVE','FULL_TIME','2023-06-15',NULL,1,1,3,3,1,NULL,NULL,NULL,NULL,'Headquarters',NULL,NULL,NULL,'2026-11-02 19:00:28.225572','2026-11-02 19:00:28.225580');
INSERT INTO "users" VALUES(5,'84afb502-13b7-42ae-95f5-39652821d177',1,'EMP-005','priya@acme.corp','$2b$12$030h3/8nJJpD.OAEsgdQ9.lnTn8ssbJ74YdlsB3lW1jPShvq14UFy','Priya','Sharma','https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80','+1 (555) 017-3321','Female',NULL,NULL,'EMPLOYEE',0,'ACTIVE','FULL_TIME','2024-02-10',NULL,3,1,4,3,1,NULL,NULL,NULL,NULL,'Headquarters',NULL,NULL,NULL,'2026-11-02 19:00:28.225598','2026-11-02 19:00:28.225601');
INSERT INTO "users" VALUES(6,'fcb201d8-39d7-49f5-9f30-ce0d7fd9933f',1,'EMP-006','marcus@acme.corp','$2b$12$LkGRJCe6wgkChEAx5tZKuuIqmcmW4Cxeh2I1AJJuHPAuGuLg3dGk.','Marcus','Vance','https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80','+1 (555) 019-8833','Male',NULL,NULL,'EMPLOYEE',0,'ACTIVE','FULL_TIME','2024-05-01',NULL,2,4,8,1,1,NULL,NULL,NULL,NULL,'Headquarters',NULL,NULL,NULL,'2026-11-02 19:00:28.225614','2026-11-02 19:00:28.225617');
INSERT INTO "users" VALUES(7,'0183d5cb-0964-4209-99c5-fd4c355b9779',1,'EMP-007','chloe@acme.corp','$2b$12$ZJ2UQspNPooqU3LrmfJXueOa3auPIVBxol9tSUM/LtRh0zPgCz0IW','Chloe','Bennett','https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80','+1 (555) 013-6622','Female',NULL,NULL,'EMPLOYEE',0,'ACTIVE','FULL_TIME','2024-07-15',NULL,1,3,7,3,1,NULL,NULL,NULL,NULL,'Headquarters',NULL,NULL,NULL,'2026-11-02 19:00:28.225630','2026-11-02 19:00:28.225632');
CREATE UNIQUE INDEX ix_companies_uuid ON companies (uuid);
CREATE UNIQUE INDEX ix_companies_code ON companies (code);
CREATE INDEX ix_companies_id ON companies (id);
CREATE UNIQUE INDEX ix_companies_slug ON companies (slug);
CREATE INDEX ix_audit_logs_id ON audit_logs (id);
CREATE UNIQUE INDEX ix_platform_admins_user_id ON platform_admins (user_id);
CREATE INDEX ix_platform_admins_id ON platform_admins (id);
CREATE INDEX ix_branches_id ON branches (id);
CREATE INDEX ix_departments_id ON departments (id);
CREATE INDEX ix_holidays_id ON holidays (id);
CREATE INDEX ix_company_settings_id ON company_settings (id);
CREATE INDEX ix_shifts_id ON shifts (id);
CREATE INDEX ix_leave_types_id ON leave_types (id);
CREATE INDEX ix_projects_id ON projects (id);
CREATE INDEX ix_salary_components_id ON salary_components (id);
CREATE INDEX ix_salary_components_company_id ON salary_components (company_id);
CREATE INDEX ix_subscriptions_company_id ON subscriptions (company_id);
CREATE INDEX ix_subscriptions_id ON subscriptions (id);
CREATE INDEX ix_organization_integrations_id ON organization_integrations (id);
CREATE INDEX ix_organization_integrations_organization_uuid ON organization_integrations (organization_uuid);
CREATE INDEX ix_organization_integrations_company_id ON organization_integrations (company_id);
CREATE INDEX ix_organization_integrations_provider ON organization_integrations (provider);
CREATE UNIQUE INDEX ix_organization_integrations_uuid ON organization_integrations (uuid);
CREATE INDEX ix_organization_drive_uploads_organization_uuid ON organization_drive_uploads (organization_uuid);
CREATE UNIQUE INDEX ix_organization_drive_uploads_uuid ON organization_drive_uploads (uuid);
CREATE INDEX ix_organization_drive_uploads_company_id ON organization_drive_uploads (company_id);
CREATE INDEX ix_organization_drive_uploads_id ON organization_drive_uploads (id);
CREATE INDEX ix_designations_id ON designations (id);
CREATE INDEX ix_tasks_id ON tasks (id);
CREATE INDEX ix_payment_transactions_id ON payment_transactions (id);
CREATE UNIQUE INDEX ix_payment_transactions_invoice_number ON payment_transactions (invoice_number);
CREATE INDEX ix_payment_transactions_company_id ON payment_transactions (company_id);
CREATE UNIQUE INDEX ix_payment_transactions_transaction_reference ON payment_transactions (transaction_reference);
CREATE UNIQUE INDEX ix_users_uuid ON users (uuid);
CREATE UNIQUE INDEX ix_users_email ON users (email);
CREATE INDEX ix_users_employee_code ON users (employee_code);
CREATE INDEX ix_users_id ON users (id);
CREATE INDEX ix_organization_members_user_id ON organization_members (user_id);
CREATE INDEX ix_organization_members_company_id ON organization_members (company_id);
CREATE UNIQUE INDEX ix_organization_members_uuid ON organization_members (uuid);
CREATE INDEX ix_organization_members_id ON organization_members (id);
CREATE INDEX ix_shift_assignments_id ON shift_assignments (id);
CREATE INDEX ix_attendance_records_id ON attendance_records (id);
CREATE INDEX ix_attendance_records_date ON attendance_records (date);
CREATE INDEX ix_leave_balances_id ON leave_balances (id);
CREATE INDEX ix_leave_requests_id ON leave_requests (id);
CREATE INDEX ix_project_members_id ON project_members (id);
CREATE INDEX ix_timesheets_id ON timesheets (id);
CREATE INDEX ix_employee_documents_id ON employee_documents (id);
CREATE INDEX ix_announcements_id ON announcements (id);
CREATE INDEX ix_hr_tickets_id ON hr_tickets (id);
CREATE INDEX ix_notifications_id ON notifications (id);
CREATE INDEX ix_face_enrollments_id ON face_enrollments (id);
CREATE INDEX ix_face_verification_logs_id ON face_verification_logs (id);
CREATE INDEX ix_fingerprint_enrollments_id ON fingerprint_enrollments (id);
CREATE INDEX ix_goals_id ON goals (id);
CREATE INDEX ix_performance_reviews_id ON performance_reviews (id);
CREATE INDEX ix_onboarding_tasks_id ON onboarding_tasks (id);
CREATE INDEX ix_lifecycle_records_id ON lifecycle_records (id);
CREATE INDEX ix_employee_salary_structures_user_id ON employee_salary_structures (user_id);
CREATE INDEX ix_employee_salary_structures_company_id ON employee_salary_structures (company_id);
CREATE INDEX ix_employee_salary_structures_id ON employee_salary_structures (id);
CREATE INDEX ix_payroll_periods_month ON payroll_periods (month);
CREATE INDEX ix_payroll_periods_company_id ON payroll_periods (company_id);
CREATE INDEX ix_payroll_periods_id ON payroll_periods (id);
CREATE INDEX ix_attendance_punches_id ON attendance_punches (id);
CREATE INDEX ix_attendance_regularizations_id ON attendance_regularizations (id);
CREATE INDEX ix_leave_approvals_id ON leave_approvals (id);
CREATE INDEX ix_time_logs_id ON time_logs (id);
CREATE INDEX ix_payslips_payroll_period_id ON payslips (payroll_period_id);
CREATE INDEX ix_payslips_user_id ON payslips (user_id);
CREATE INDEX ix_payslips_company_id ON payslips (company_id);
CREATE INDEX ix_payslips_id ON payslips (id);
DELETE FROM "sqlite_sequence";
COMMIT;
