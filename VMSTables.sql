DROP DATABASE IF EXISTS VMS;
CREATE DATABASE VMS;
USE VMS;

-- Table: patient
CREATE TABLE Patient (
    patient_id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE, -- Date of birth cannot be in the future
    gender ENUM('Male', 'Female', 'Other') NOT NULL,       -- Gender should be restricted to valid options
    blood_group VARCHAR(3) CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-')), -- Valid blood groups
    phone_number VARCHAR(15) CHECK (phone_number REGEXP '^[0-9]+$'), -- Ensure phone number contains only digits
    email VARCHAR(100) UNIQUE,                             -- Ensure email is unique per patient
    address VARCHAR(255),
    password VARCHAR(255) NOT NULL -- Adjust the length based on your hashing strategy
);

-- Table: Vaccine Manufacturer
CREATE TABLE Vaccine_Manufacturer (
    manufacturer_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    phone_number VARCHAR(15) CHECK (phone_number REGEXP '^[0-9]+$'), -- Only digits allowed in phone number
    email VARCHAR(100) UNIQUE,                                      -- Ensure manufacturer's email is unique
    address VARCHAR(255)
);

-- Table: Vaccine
CREATE TABLE Vaccine (
    vaccine_id INT PRIMARY KEY AUTO_INCREMENT,
    vaccine_name VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('Inactivated', 'Live', 'Subunit', 'mRNA', 'Vector')), -- Limited to specific vaccine types
    manufacturer_id INT,
    dosage_amount DECIMAL(5,2) NOT NULL CHECK (dosage_amount > 0),  -- Dosage must be positive
    required_doses INT NOT NULL CHECK (required_doses >= 1),        -- Must require at least one dose
    side_effects VARCHAR(255),
    storage_conditions VARCHAR(255),
    FOREIGN KEY (manufacturer_id) REFERENCES Vaccine_Manufacturer(manufacturer_id)
);

-- Table: Facility
CREATE TABLE Facility (
    facility_id INT PRIMARY KEY AUTO_INCREMENT,
    facility_name VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    phone_number VARCHAR(15) CHECK (phone_number REGEXP '^[0-9]+$'),
    email VARCHAR(100) UNIQUE, -- Make email unique
    facility_type VARCHAR(50) CHECK (facility_type IN ('Hospital', 'Clinic', 'Vaccination Center')), -- Restrict to certain facility types
    max_storage_capacity INT NOT NULL CHECK (max_storage_capacity > 0) -- Capacity must be a positive number
);

-- Table: Health Worker
CREATE TABLE Health_Worker (
    health_worker_id VARCHAR(10) PRIMARY KEY, -- Use VARCHAR to allow IDs like "HW123"
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    facility_id INT,
    phone_number VARCHAR(15) CHECK (phone_number REGEXP '^[0-9]+$'),
    email VARCHAR(100) UNIQUE, -- Make email unique
    address VARCHAR(255),
    password VARCHAR(255) NOT NULL, -- Adjust the length based on your hashing strategy 
    FOREIGN KEY (facility_id) REFERENCES Facility(facility_id) -- Reference to Facility
);

-- Table: Facility Manager
CREATE TABLE Facility_Manager (
    facility_manager_id VARCHAR(10) PRIMARY KEY, -- Use VARCHAR to allow IDs like "FM123"
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(15) CHECK (phone_number REGEXP '^[0-9]+$'), -- Ensure phone number contains only digits
    email VARCHAR(100) UNIQUE,                             -- Ensure email is unique per patient
    address VARCHAR(255),
    facility_id INT,
    password VARCHAR(255) NOT NULL, -- Adjust the length based on your hashing strategy 
    FOREIGN KEY (facility_id) REFERENCES Facility(facility_id) -- Reference to Facility
);

-- Table: Inventory (now tracking batches of vaccines)
CREATE TABLE Inventory (
    batch_number VARCHAR(50) PRIMARY KEY,
    facility_id INT,          -- which facility stores this batch
    vaccine_id INT,           -- which vaccine type (conceptual)
    stock_quantity INT NOT NULL CHECK (stock_quantity >= 0), -- Stock cannot be negative
    expiry_date DATE NOT NULL, -- Expiry date cannot be in the past
    FOREIGN KEY (facility_id) REFERENCES Facility(facility_id),
    FOREIGN KEY (vaccine_id) REFERENCES Vaccine(vaccine_id)
);

-- Table: Vaccination Record
CREATE TABLE Vaccination_Record (
    record_id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT,
    vaccine_id INT,
    health_worker_id VARCHAR(10),
    vaccination_date DATE NOT NULL, -- Vaccination date cannot be in the future
    dose_given INT NOT NULL CHECK (dose_given > 0),              -- Dose must be a positive amount
    batch_number VARCHAR(50),             -- Track the batch the dose comes from
    FOREIGN KEY (patient_id) REFERENCES Patient(patient_id),
    FOREIGN KEY (vaccine_id) REFERENCES Vaccine(vaccine_id),
    FOREIGN KEY (health_worker_id) REFERENCES Health_Worker(health_worker_id),
    FOREIGN KEY (batch_number) REFERENCES Inventory(batch_number)
);

-- Table: Appointment
CREATE TABLE Appointment (
    appointment_id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT NOT NULL,                    -- Reference to the patient scheduling the appointment
    facility_id INT NOT NULL,                   -- Reference to the facility where the appointment is scheduled
    health_worker_id VARCHAR(10),               -- Reference to the health worker attending the appointment
    vaccine_id INT NOT NULL,                    -- Reference to the vaccine
    appointment_date DATE NOT NULL,             -- Date of the appointment
    time_slot ENUM('Morning', 'Afternoon', 'Evening') NOT NULL, -- Time slot
    status ENUM('Scheduled', 'Completed', 'Canceled') DEFAULT 'Scheduled', -- Status of the appointment
    comments VARCHAR(255),                      -- Optional comments for the appointment
    FOREIGN KEY (patient_id) REFERENCES Patient(patient_id),
    FOREIGN KEY (facility_id) REFERENCES Facility(facility_id),
    FOREIGN KEY (health_worker_id) REFERENCES Health_Worker(health_worker_id),
    FOREIGN KEY (vaccine_id) REFERENCES Vaccine(vaccine_id)
);

DELIMITER $$

CREATE PROCEDURE GetHealthWorkerWithLeastAppointments(IN facilityId INT)
BEGIN
    SELECT 
        hw.health_worker_id
    FROM 
        Health_Worker hw
    LEFT JOIN 
        Appointment a ON hw.health_worker_id = a.health_worker_id
    WHERE 
        hw.facility_id = facilityId
    GROUP BY 
        hw.health_worker_id
    ORDER BY 
        COUNT(a.appointment_id) ASC
    LIMIT 1;
END $$

DELIMITER ;




