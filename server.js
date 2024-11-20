const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcrypt");
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // For form submissions
app.use(bodyParser.json()); // For JSON data
app.use(express.static("A:/Projects/VMS/frontend"));

// Database connection
const db = mysql.createConnection({
	host: "localhost",
	user: "root",
	password: "madan123",
	database: "vms",
});

db.connect((err) => {
	if (err) throw err;
	console.log("Connected to the database.");
});

app.post("/register-patient", async (req, res) => {
	const {
		first_name,
		last_name,
		date_of_birth,
		gender,
		blood_group,
		phone_number,
		email,
		address,
		password,
	} = req.body;

	// Validation checks
	const today = new Date();
	const dob = new Date(date_of_birth);

	if (dob > today) {
		return res
			.status(400)
			.send({ message: "Date of Birth cannot be in the future." });
	}

	if (!/^\d{10}$/.test(phone_number)) {
		return res
			.status(400)
			.send({ message: "Phone number must be exactly 10 digits." });
	}

	// Check if email already exists
	db.query(
		"SELECT email FROM Patient WHERE email = ?",
		[email],
		async (err, results) => {
			if (err) {
				console.error(err);
				return res.status(500).send({ message: "Database error." });
			}

			if (results.length > 0) {
				return res
					.status(400)
					.send({ message: "Email already exists." });
			}

			try {
				// Hash the password
				const hashedPassword = await bcrypt.hash(password, 10);

				// Insert new patient
				const query =
					"INSERT INTO Patient (first_name, last_name, date_of_birth, gender, blood_group, phone_number, email, address, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
				db.query(
					query,
					[
						first_name,
						last_name,
						date_of_birth,
						gender,
						blood_group,
						phone_number,
						email,
						address,
						hashedPassword,
					],
					(err, result) => {
						if (err) {
							console.error(err);
							return res.status(500).send({
								message: "Error registering patient.",
							});
						}
						res.status(200).send({
							message: "Registration successful.",
						});
					}
				);
			} catch (error) {
				console.error(error);
				res.status(500).send({ message: "Error registering patient." });
			}
		}
	);
});

app.post("/login", (req, res) => {
	const { email, password } = req.body;
	const query = "SELECT * FROM Patient WHERE email = ?";
	db.query(query, [email], async (err, results) => {
		if (err) {
			console.error("Database error:", err);
			return res.status(500).send({ message: "Database error" });
		}

		if (results.length === 0) {
			return res
				.status(401)
				.send({ message: "Invalid email or password" });
		}

		const user = results[0];
		const passwordMatch = await bcrypt.compare(password, user.password);

		if (passwordMatch) {
			res.status(200).send({
				message: "Login successful",
				user: {
					patient_id: user.patient_id,
					first_name: user.first_name,
				},
			});
		} else {
			res.status(401).send({ message: "Invalid email or password" });
		}
	});
});

// Define route to get vaccines
app.get("/vaccines", (req, res) => {
	const query = "SELECT vaccine_id, vaccine_name FROM Vaccine";

	db.query(query, (err, results) => {
		if (err) {
			console.error("Error fetching vaccines:", err);
			res.status(500).json({ error: "Database query error" });
		} else {
			res.json(results); // Send JSON response with vaccine data
		}
	});
});

app.get("/facilities", (req, res) => {
	const { vaccine_id } = req.query;
	const query = `
        SELECT Facility.facility_id, Facility.facility_name 
        FROM Facility
        JOIN Inventory ON Facility.facility_id = Inventory.facility_id
        WHERE Inventory.vaccine_id = ?
    `;
	db.query(query, [vaccine_id], (error, results) => {
		if (error) {
			return res.status(500).json({ error: "Database error" });
		}
		res.json(results);
	});
});

app.get("/health-worker/:id", (req, res) => {
	const healthWorkerId = req.params.id;
	const query =
		"SELECT first_name, last_name FROM Health_Worker WHERE health_worker_id = ?";

	db.query(query, [healthWorkerId], (err, results) => {
		if (err) {
			console.error("Error fetching health worker details:", err);
			return res.status(500).send({ message: "Database error" });
		}

		if (results.length > 0) {
			res.json(results[0]); // Send back the health worker's details
		} else {
			res.status(404).send({ message: "Health worker not found" });
		}
	});
});

// Endpoint to get today's appointments for a specific health worker
app.get("/appointments/today/:healthWorkerId", (req, res) => {
	const healthWorkerId = req.params.healthWorkerId;
	const today = new Date().toISOString().split("T")[0]; // Get today's date in 'YYYY-MM-DD' format
	const query = `
        SELECT p.first_name AS patient_name, v.vaccine_name, a.time_slot, a.comments, f.facility_name
        FROM Appointment a
        JOIN Facility f ON a.facility_id = f.facility_id
        JOIN Patient p ON a.patient_id = p.patient_id
        JOIN Vaccine v ON a.vaccine_id = v.vaccine_id
        WHERE a.health_worker_id = ? AND a.appointment_date = ?
        ORDER BY FIELD(a.time_slot, 'Morning', 'Afternoon', 'Evening')
    `;

	db.query(query, [healthWorkerId, today], (error, results) => {
		if (error) {
			console.error("Error fetching appointments:", error);
			return res.status(500).json({ error: "Database error" });
		}
		res.json(results);
	});
});

// Endpoint to get all appointments for a specific health worker
app.get("/appointments/:healthWorkerId", (req, res) => {
	const healthWorkerId = req.params.healthWorkerId;
	const query = `
        SELECT p.first_name AS patient_name, v.vaccine_name, a.appointment_date, a.time_slot, a.comments
        FROM Appointment a
        JOIN Patient p ON a.patient_id = p.patient_id
        JOIN Vaccine v ON a.vaccine_id = v.vaccine_id
        WHERE a.health_worker_id = ?
        ORDER BY a.appointment_date ASC
    `;

	db.query(query, [healthWorkerId], (error, results) => {
		if (error) {
			console.error("Error fetching appointments:", error);
			return res.status(500).json({ error: "Database error" });
		}
		res.json(results);
	});
});

// Endpoint to get health workers by facility
app.get("/health-workers", (req, res) => {
	const facilityId = req.query.facility_id;
	const sql =
		"SELECT health_worker_id, first_name, last_name FROM Health_Worker WHERE facility_id = ?";

	db.query(sql, [facilityId], (error, results) => {
		if (error) {
			console.error("Error fetching health workers:", error);
			return res.status(500).json({ error: "Database query failed" });
		}
		res.json(results);
	});
});

// Endpoint to book an appointment
app.post("/appointments", (req, res) => {
	const {
		patient_id,
		vaccine_id,
		facility_id,
		health_worker_id,
		appointment_date,
		time_slot,
		comments,
	} = req.body;

	const query = `
        INSERT INTO Appointment (patient_id, vaccine_id, facility_id, health_worker_id, appointment_date, time_slot, comments)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

	db.query(
		query,
		[
			patient_id,
			vaccine_id,
			facility_id,
			health_worker_id || null,
			appointment_date,
			time_slot,
			comments,
		],
		(error, results) => {
			if (error) {
				console.error("Error inserting appointment:", error);
				return res
					.status(500)
					.json({ error: "Failed to book appointment" });
			}
			res.status(201).json({
				message: "Appointment booked successfully!",
				appointment_id: results.insertId,
			});
		}
	);
});

app.get("/appointments", (req, res) => {
	const patientId = req.query.patient_id;
	const query = `
        SELECT a.appointment_id, a.appointment_date, a.time_slot, a.status, a.comments,
               f.facility_name, hw.first_name AS health_worker_name, v.vaccine_name
        FROM Appointment a
        JOIN Facility f ON a.facility_id = f.facility_id
        LEFT JOIN Health_Worker hw ON a.health_worker_id = hw.health_worker_id
        JOIN Vaccine v ON a.vaccine_id = v.vaccine_id
        WHERE a.patient_id = ?
        ORDER BY a.appointment_date ASC
    `;

	db.query(query, [patientId], (error, results) => {
		if (error) {
			console.error("Error fetching appointments:", error);
			return res.status(500).json({ error: "Database error" });
		}
		res.json(results);
	});
});

// Endpoint to get patient details by ID
app.get("/patients/:id", (req, res) => {
	const patientId = req.params.id;
	const query = "SELECT first_name FROM Patient WHERE patient_id = ?"; // Adjust according to your actual Patient table structure

	db.query(query, [patientId], (err, results) => {
		if (err) {
			console.error(err);
			return res.status(500).send({ message: "Database error" });
		}

		if (results.length > 0) {
			res.json(results[0]); // Send back the patient details
		} else {
			res.status(404).send({ message: "Patient not found" });
		}
	});
});

app.post("/staff-login", (req, res) => {
	const { userId, password } = req.body;

	// Determine user type based on ID prefix
	let tableName = "";
	let userType = ""; // Add this to identify the user type
	if (userId.startsWith("HW")) {
		tableName = "Health_Worker";
		userType = "HW";
	} else if (userId.startsWith("FM")) {
		tableName = "Facility_Manager";
		userType = "FM";
	} else {
		return res.status(400).send({ message: "Invalid User ID format" });
	}

	// SQL query to find the user by ID
	const query = `SELECT * FROM ${tableName} WHERE ${tableName.toLowerCase()}_id = ?`;
	db.query(query, [userId], async (err, results) => {
		if (err) {
			console.error("Database error:", err);
			return res.status(500).send({ message: "Database error" });
		}

		if (results.length === 0) {
			return res
				.status(401)
				.send({ message: "Invalid User ID or Password" });
		}

		const user = results[0];
		const passwordMatch = await bcrypt.compare(password, user.password);

		if (passwordMatch) {
			res.status(200).send({
				message: "Login successful",
				user: { id: userId, name: user.first_name },
				userType: userType, // Include userType in the response
			});
		} else {
			res.status(401).send({ message: "Invalid User ID or Password" });
		}
	});
});

// Endpoint to get vaccine batches for a specific health worker
app.get("/batches/:healthWorkerId", (req, res) => {
	const healthWorkerId = req.params.healthWorkerId;
	const vaccineId = req.query.vaccineId; // Get the vaccine ID from query parameters

	// Query to get vaccine batches related to the health worker's facility and the selected vaccine
	const query = `
        SELECT i.batch_number, i.expiry_date, v.vaccine_name 
        FROM Inventory i
        JOIN Vaccine v ON i.vaccine_id = v.vaccine_id
        WHERE i.facility_id = (
            SELECT facility_id 
            FROM Health_Worker 
            WHERE health_worker_id = ?
        ) AND i.vaccine_id = ?`; // Filter by vaccine_id

	db.query(query, [healthWorkerId, vaccineId], (error, results) => {
		if (error) {
			console.error("Error fetching batch numbers:", error);
			return res.status(500).json({ error: "Database error" });
		}
		res.json(results); // Send JSON response with batch data
	});
});

// Endpoint to get vaccines from inventory based on health worker ID
app.get("/distinct/:healthWorkerId", (req, res) => {
	const healthWorkerId = req.params.healthWorkerId;

	// Query to get the facility ID for the health worker
	const facilityQuery = `
        SELECT facility_id 
        FROM Health_Worker 
        WHERE health_worker_id = ?
    `;

	db.query(facilityQuery, [healthWorkerId], (err, facilityResults) => {
		if (err) {
			console.error("Error fetching facility ID:", err);
			return res.status(500).json({ error: "Database error" });
		}

		if (facilityResults.length === 0) {
			return res.status(404).json({ error: "Health worker not found" });
		}

		const facilityId = facilityResults[0].facility_id;

		// Query to get distinct vaccines from the inventory of the identified facility
		const vaccineQuery = `
            SELECT DISTINCT v.vaccine_id, v.vaccine_name
            FROM Inventory i
            JOIN Vaccine v ON i.vaccine_id = v.vaccine_id
            WHERE i.facility_id = ?
        `;

		db.query(vaccineQuery, [facilityId], (err, vaccineResults) => {
			if (err) {
				console.error("Error fetching vaccines from inventory:", err);
				return res.status(500).json({ error: "Database query error" });
			}
			res.json(vaccineResults); // Send JSON response with vaccine data
		});
	});
});

// Endpoint to log vaccination event
app.post("/vaccination", (req, res) => {
	const {
		patient_id,
		vaccine_id,
		health_worker_id,
		vaccination_date,
		dose_given,
		batch_number,
	} = req.body;

	// SQL query to insert record
	const query = `
        INSERT INTO Vaccination_Record (patient_id, vaccine_id, health_worker_id, vaccination_date, dose_given, batch_number)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

	db.query(
		query,
		[
			patient_id,
			vaccine_id,
			health_worker_id,
			vaccination_date,
			dose_given,
			batch_number,
		],
		(error, results) => {
			if (error) {
				console.error("Error inserting vaccination record:", error);
				return res
					.status(500)
					.json({ error: "Failed to log vaccination event" });
			}
			res.status(201).json({
				message: "Vaccination record created successfully!",
				record_id: results.insertId,
			});
		}
	);
});

// Endpoint to get the inventory for a specific health worker
app.get("/inventory/:healthWorkerId", (req, res) => {
	const healthWorkerId = req.params.healthWorkerId;

	// Query to get the facility ID for the health worker
	const facilityQuery = `
        SELECT facility_id 
        FROM Health_Worker 
        WHERE health_worker_id = ?
    `;

	db.query(facilityQuery, [healthWorkerId], (err, facilityResults) => {
		if (err) {
			console.error("Error fetching facility ID:", err);
			return res.status(500).json({ error: "Database error" });
		}

		if (facilityResults.length === 0) {
			return res.status(404).json({ error: "Health worker not found" });
		}

		const facilityId = facilityResults[0].facility_id;

		// Query to get inventory details for the facility
		const inventoryQuery = `
            SELECT v.vaccine_name, i.stock_quantity AS available_doses, 
                   i.batch_number, i.expiry_date
            FROM Inventory i
            JOIN Vaccine v ON i.vaccine_id = v.vaccine_id
            WHERE i.facility_id = ?
        `;

		db.query(inventoryQuery, [facilityId], (err, inventoryResults) => {
			if (err) {
				console.error("Error fetching inventory:", err);
				return res.status(500).json({ error: "Database error" });
			}
			res.json(inventoryResults); // Send JSON response with inventory data
		});
	});
});

// Endpoint to update inventory doses after vaccination event
app.post("/inventory/update", (req, res) => {
	const { batchNumber, doseGiven } = req.body;

	const updateQuery = `
        UPDATE Inventory 
        SET stock_quantity = stock_quantity - ?
        WHERE batch_number = ? AND stock_quantity >= ?
    `;

	db.query(
		updateQuery,
		[doseGiven, batchNumber, doseGiven],
		(err, results) => {
			if (err) {
				console.error("Error updating inventory:", err);
				return res.status(500).json({ error: "Database error" });
			}

			if (results.affectedRows === 0) {
				// This means stock_quantity wasn't sufficient for the doseGiven
				return res.status(400).json({ error: "Insufficient stock" });
			}

			res.json({ message: "Inventory updated successfully" });
		}
	);
});

// Endpoint to get vaccination history for a specific patient
app.get("/vaccination-history/:patientId", (req, res) => {
	const patientId = req.params.patientId;

	// Query to fetch vaccination records for the patient
	const query = `
    SELECT vr.record_id, vr.vaccination_date, 
           CONCAT(hw.first_name, ' ', hw.last_name) AS health_worker_name, 
           v.vaccine_name, vr.dose_given, vr.batch_number
    FROM vaccination_record vr
    JOIN Vaccine v ON vr.vaccine_id = v.vaccine_id
    JOIN Health_Worker hw ON vr.health_worker_id = hw.health_worker_id
    WHERE vr.patient_id = ?
    ORDER BY vr.vaccination_date DESC;
`;

	db.query(query, [patientId], (error, results) => {
		if (error) {
			console.error("Error fetching vaccination history:", error);
			return res.status(500).json({ error: "Database error" });
		}
		res.json(results); // Send JSON response with vaccination history
	});
});

app.get("/facility-manager/:id", (req, res) => {
	const facilityManagerId = req.params.id;

	// SQL query to fetch the facility manager's details
	const query =
		"SELECT first_name FROM Facility_Manager WHERE facility_manager_id = ?";

	db.query(query, [facilityManagerId], (err, results) => {
		if (err) {
			console.error("Error fetching facility manager details:", err);
			return res.status(500).send({ message: "Database error" });
		}

		if (results.length === 0) {
			return res
				.status(404)
				.send({ message: "Facility Manager not found" });
		}

		// Send only the first_name of the first result
		const firstName = results[0].first_name;
		res.json({ first_name: firstName });
	});
});

app.get("/facility-manager/:id/appointments", (req, res) => {
	const facilityManagerId = req.params.id;

	// Query to fetch all appointments with health worker's name for the facility managed by the given facility manager
	const query = `
    SELECT 
        a.appointment_id, 
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        CONCAT(hw.first_name, ' ', hw.last_name) AS health_worker_name,  -- Fetch health worker's name
        a.health_worker_id,
        v.vaccine_name,
        DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,  -- Format the date to just YYYY-MM-DD
        a.time_slot,
        a.status,
        a.comments
    FROM Appointment a
    JOIN Patient p ON a.patient_id = p.patient_id
    JOIN Vaccine v ON a.vaccine_id = v.vaccine_id
    JOIN Facility f ON a.facility_id = f.facility_id
    JOIN Facility_Manager fm ON f.facility_id = fm.facility_id
    JOIN Health_Worker hw ON a.health_worker_id = hw.health_worker_id  -- Join Health_Worker table to get health worker name
    WHERE fm.facility_manager_id = ?;
    `;

	db.query(query, [facilityManagerId], (err, results) => {
		if (err) {
			console.error("Error fetching appointments:", err);
			return res.status(500).send({ message: "Database error" });
		}

		if (results.length === 0) {
			return res.status(404).send({ message: "No appointments found" });
		}

		// Send the results as JSON
		res.json(results);
	});
});

app.get("/facility-manager/:id/healthworkers", (req, res) => {
	const facilityManagerId = req.params.id;

	// Step 1: Get the facility ID using the facility manager ID
	const getFacilityIdQuery =
		"SELECT facility_id FROM Facility_Manager WHERE facility_manager_id = ?";

	db.query(
		getFacilityIdQuery,
		[facilityManagerId],
		(err, facilityResults) => {
			if (err) {
				console.error("Error fetching facility ID:", err);
				return res.status(500).send({ message: "Database error" });
			}

			if (facilityResults.length === 0) {
				return res.status(404).send({
					message: "Facility not found for the given manager",
				});
			}

			const facilityId = facilityResults[0].facility_id;

			// Step 2: Fetch all health worker details associated with the facility
			const getHealthWorkersQuery = `
            SELECT 
                health_worker_id, 
                first_name, 
                last_name, 
                facility_id, 
                phone_number, 
                email, 
                address
            FROM Health_Worker 
            WHERE facility_id = ?
        `;

			db.query(
				getHealthWorkersQuery,
				[facilityId],
				(err, healthWorkerResults) => {
					if (err) {
						console.error("Error fetching health workers:", err);
						return res
							.status(500)
							.send({ message: "Database error" });
					}

					// Respond with the list of health workers with full details
					res.json(healthWorkerResults);
				}
			);
		}
	);
});

app.get("/health-worker2/:id", (req, res) => {
	const healthWorkerId = req.params.id;
	const query = "SELECT * FROM Health_Worker WHERE health_worker_id = ?";

	db.query(query, [healthWorkerId], (err, result) => {
		if (err) {
			console.error("Error fetching health worker details:", err);
			return res.status(500).send({ message: "Database error" });
		}

		if (result.length === 0) {
			return res.status(404).send({ message: "Health Worker not found" });
		}

		// Send back the health worker details
		res.json(result[0]);
	});
});

// Update Health Worker details using PUT
app.put("/health-worker2/:healthWorkerId", async (req, res) => {
	const { healthWorkerId } = req.params;
	const { first_name, last_name, email, phone_number, address, facility_id } =
		req.body;

	// Regex for phone number validation (only numbers)
	const phoneRegex = /^[0-9]+$/;
	if (!phoneRegex.test(phone_number)) {
		return res.status(400).json({ message: "Invalid phone number format" });
	}

	try {
		// Update the health worker in the Health_Worker table
		const query = `
            UPDATE Health_Worker 
            SET first_name = ?, last_name = ?, email = ?, phone_number = ?, address = ?, facility_id = ? 
            WHERE health_worker_id = ?`;

		db.query(
			query,
			[
				first_name,
				last_name,
				email,
				phone_number,
				address,
				facility_id,
				healthWorkerId,
			],
			(error, results) => {
				if (error) {
					console.error("Error updating health worker:", error);
					return res.status(500).json({ message: "Server error" });
				}

				if (results.affectedRows === 0) {
					return res
						.status(404)
						.json({ message: "Health worker not found" });
				}

				// Query the updated health worker details
				const selectQuery =
					"SELECT * FROM Health_Worker WHERE health_worker_id = ?";
				db.query(
					selectQuery,
					[healthWorkerId],
					(selectError, selectResults) => {
						if (selectError) {
							console.error(
								"Error fetching updated health worker:",
								selectError
							);
							return res
								.status(500)
								.json({ message: "Server error" });
						}

						// Return the updated health worker details
						res.json(selectResults[0]);
					}
				);
			}
		);
	} catch (error) {
		console.error("Error updating health worker:", error);
		res.status(500).json({ message: "Server error" });
	}
});

app.delete("/health-worker2/:id", (req, res) => {
	const { id } = req.params;

	// MySQL query to delete the health worker by id
	const query = "DELETE FROM Health_Worker WHERE health_worker_id = ?";

	db.query(query, [id], (err, results) => {
		if (err) {
			console.error("Error deleting health worker:", err);
			return res.status(500).json({
				message: "Failed to delete Health Worker",
				error: err,
			});
		}

		// Check if any rows were affected (i.e., health worker was deleted)
		if (results.affectedRows > 0) {
			return res
				.status(200)
				.json({ message: "Health Worker deleted successfully" });
		} else {
			return res.status(404).json({ message: "Health Worker not found" });
		}
	});
});

app.post("/add-health-worker", async (req, res) => {
	const {
		health_worker_id,
		first_name,
		last_name,
		email,
		phone_number,
		address,
		facility_manager_id,
	} = req.body;

	try {
		// Query to fetch facility_id using facility_manager_id
		const facilityQuery = `SELECT facility_id FROM Facility_Manager WHERE facility_manager_id = ?`;

		db.query(
			facilityQuery,
			[facility_manager_id],
			(facilityErr, facilityResult) => {
				if (facilityErr) {
					console.error(facilityErr);
					return res.status(500).send({
						message: "Error retrieving facility information",
					});
				}

				if (facilityResult.length === 0) {
					return res
						.status(404)
						.send({ message: "Facility Manager not found" });
				}

				const facility_id = facilityResult[0].facility_id;

				// Predefined hashed password
				const password =
					"$2a$10$ifl9mFignyKlZA/jq5Kv7u1lUtmq..gehqzs1PMFY0B93.3AxHpze";

				// SQL query to insert a new health worker
				const insertQuery = `
                INSERT INTO Health_Worker 
                (health_worker_id, first_name, last_name, email, phone_number, address, facility_id, password) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

				db.query(
					insertQuery,
					[
						health_worker_id,
						first_name,
						last_name,
						email,
						phone_number,
						address,
						facility_id,
						password,
					],
					(insertErr, insertResult) => {
						if (insertErr) {
							console.error(insertErr);
							return res.status(500).send({
								message: "Error adding health worker",
							});
						}

						res.status(200).send({
							message: "Health Worker added successfully",
						});
					}
				);
			}
		);
	} catch (error) {
		console.error(error);
		res.status(500).send({
			message: "An error occurred while adding the health worker",
		});
	}
});

app.get("/facility-info", async (req, res) => {
	const { facilityManagerId } = req.query;

	try {
		const query = `
            SELECT 
                Facility.facility_name,
                Facility.location,
                Facility.phone_number,
                Facility.email,
                Facility.facility_type,
                Facility.max_storage_capacity
            FROM Facility
            JOIN Facility_Manager ON Facility.facility_id = Facility_Manager.facility_id
            WHERE Facility_Manager.facility_manager_id = ?
        `;

		db.query(query, [facilityManagerId], (err, results) => {
			if (err) {
				console.error("SQL Error:", err);
				return res
					.status(500)
					.send({ message: "Error retrieving facility info" });
			}

			if (results.length === 0) {
				return res.status(404).send({
					message: "Facility not found for this Facility Manager",
				});
			}

			res.status(200).send(results[0]);
		});
	} catch (error) {
		console.error("Catch Block Error:", error);
		res.status(500).send({
			message: "An error occurred while fetching facility info",
		});
	}
});

app.put("/update-facility", async (req, res) => {
	const { facilityManagerId } = req.query;
	const {
		facility_name,
		location,
		phone_number,
		email,
		facility_type,
		max_storage_capacity,
	} = req.body;

	try {
		// Get the facility_id for the manager
		const queryFacilityId = `SELECT facility_id FROM Facility_Manager WHERE facility_manager_id = ?`;
		db.query(queryFacilityId, [facilityManagerId], (err, results) => {
			if (err || results.length === 0) {
				console.error(err || "Facility Manager not found");
				return res
					.status(404)
					.send({ message: "Facility Manager not found" });
			}

			const facilityId = results[0].facility_id;

			// Update facility details
			const updateQuery = `
                UPDATE Facility 
                SET 
                    facility_name = ?, 
                    location = ?, 
                    phone_number = ?, 
                    email = ?, 
                    facility_type = ?, 
                    max_storage_capacity = ? 
                WHERE facility_id = ?`;

			db.query(
				updateQuery,
				[
					facility_name,
					location,
					phone_number,
					email,
					facility_type,
					max_storage_capacity,
					facilityId,
				],
				(updateErr, updateResults) => {
					if (updateErr) {
						console.error(updateErr);
						return res
							.status(500)
							.send({ message: "Error updating facility info" });
					}

					res.status(200).send({
						message: "Facility info updated successfully",
					});
				}
			);
		});
	} catch (error) {
		console.error(error);
		res.status(500).send({
			message: "An error occurred while updating facility info",
		});
	}
});

// Fetch all manufacturers
app.get("/manufacturers", (req, res) => {
	const query = "SELECT * FROM Vaccine_Manufacturer";

	db.query(query, (err, results) => {
		if (err) {
			console.error("Error fetching manufacturers:", err);
			return res
				.status(500)
				.json({ message: "Failed to fetch manufacturers" });
		}

		res.json(results);
	});
});

// Add a manufacturer
app.post("/manufacturers", (req, res) => {
	const { name, phone_number, email, address } = req.body;

	const insertQuery = `
        INSERT INTO Vaccine_Manufacturer (name, phone_number, email, address) 
        VALUES (?, ?, ?, ?)
    `;

	db.query(
		insertQuery,
		[name, phone_number, email, address],
		(err, result) => {
			if (err) {
				console.error("Error adding manufacturer:", err);
				return res
					.status(500)
					.json({ message: "Failed to add manufacturer" });
			}

			res.status(201).json({
				id: result.insertId,
				message: "Manufacturer added successfully",
			});
		}
	);
});

// Delete a manufacturer
app.delete("/manufacturers/:id", (req, res) => {
	const { id } = req.params;

	const deleteQuery =
		"DELETE FROM Vaccine_Manufacturer WHERE manufacturer_id = ?";

	db.query(deleteQuery, [id], (err, results) => {
		if (err) {
			console.error("Error deleting manufacturer:", err);
			return res
				.status(500)
				.json({ message: "Failed to delete manufacturer" });
		}

		if (results.affectedRows === 0) {
			return res.status(404).json({ message: "Manufacturer not found" });
		}

		res.json({ message: "Manufacturer deleted successfully" });
	});
});

// Route to fetch manufacturer by ID
app.get("/manufacturers/:id", (req, res) => {
	const { id } = req.params;

	// Query the database to get the manufacturer by ID
	const query =
		"SELECT * FROM Vaccine_Manufacturer WHERE manufacturer_id = ?";
	db.query(query, [id], (err, result) => {
		if (err) {
			console.error("Error executing query:", err);
			return res
				.status(500)
				.json({ message: "Failed to fetch manufacturer details" });
		}

		if (result.length === 0) {
			return res.status(404).json({ message: "Manufacturer not found" });
		}

		// Send the manufacturer details as a response
		res.json(result[0]); // result[0] is the first and only manufacturer object
	});
});

// Endpoint to update manufacturer details
app.put("/manufacturers/:id", (req, res) => {
	const manufacturerId = req.params.id;
	const { name, phone_number, email, address } = req.body;

	// Prepare the update query
	const query = `
        UPDATE Vaccine_Manufacturer
        SET name = ?, phone_number = ?, email = ?, address = ?
        WHERE manufacturer_id = ?`;

	db.query(
		query,
		[name, phone_number, email, address, manufacturerId],
		(err, result) => {
			if (err) {
				return res
					.status(500)
					.json({ error: "Failed to update manufacturer" });
			}
			if (result.affectedRows === 0) {
				return res
					.status(404)
					.json({ error: "Manufacturer not found" });
			}
			// Fetch and return the updated manufacturer data
			const updatedManufacturer = {
				manufacturer_id: manufacturerId,
				name,
				phone_number,
				email,
				address,
			};
			res.json(updatedManufacturer);
		}
	);
});

// POST route to add a new manufacturer
app.post("/manufacturers", (req, res) => {
	const { name, phone_number, email, address } = req.body;

	// SQL query to insert the manufacturer into the database
	const query =
		"INSERT INTO manufacturers (name, phone_number, email, address) VALUES (?, ?, ?, ?)";

	db.query(query, [name, phone_number, email, address], (err, results) => {
		if (err) {
			console.error("Error adding manufacturer:", err);
			return res
				.status(500)
				.json({ message: "Failed to add manufacturer" });
		}

		// Send back the newly added manufacturer (optional: you can return the results.insertId for the new record)
		res.status(201).json({
			id: results.insertId,
			name,
			phone_number,
			email,
			address,
		});
	});
});

// Fetch all facilities
app.get("/facilitiesAdmin", (req, res) => {
	const query = "SELECT * FROM Facility";
	db.query(query, (err, results) => {
		if (err)
			return res
				.status(500)
				.json({ error: "Failed to fetch facilities" });
		res.json(results);
	});
});

// Add a facility
app.post("/facilities", (req, res) => {
	const {
		facility_name,
		location,
		phone_number,
		email,
		facility_type,
		max_storage_capacity,
	} = req.body;
	const query = `
        INSERT INTO Facility (facility_name, location, phone_number, email, facility_type, max_storage_capacity)
        VALUES (?, ?, ?, ?, ?, ?)`;
	db.query(
		query,
		[
			facility_name,
			location,
			phone_number,
			email,
			facility_type,
			max_storage_capacity,
		],
		(err, result) => {
			if (err)
				return res
					.status(500)
					.json({ error: "Failed to add facility" });
			res.status(201).json({ id: result.insertId });
		}
	);
});

// Update a facility
app.put("/facilities/:id", (req, res) => {
	const id = req.params.id;
	const {
		facility_name,
		location,
		phone_number,
		email,
		facility_type,
		max_storage_capacity,
	} = req.body;
	const query = `
        UPDATE Facility SET facility_name = ?, location = ?, phone_number = ?, email = ?, 
        facility_type = ?, max_storage_capacity = ? WHERE facility_id = ?`;
	db.query(
		query,
		[
			facility_name,
			location,
			phone_number,
			email,
			facility_type,
			max_storage_capacity,
			id,
		],
		(err, result) => {
			if (err)
				return res
					.status(500)
					.json({ error: "Failed to update facility" });
			if (result.affectedRows === 0)
				return res.status(404).json({ error: "Facility not found" });
			res.json({ message: "Facility updated successfully" });
		}
	);
});

// Delete a facility
app.delete("/facilities/:id", (req, res) => {
	const id = req.params.id;
	const query = "DELETE FROM Facility WHERE facility_id = ?";
	db.query(query, [id], (err, result) => {
		if (err)
			return res.status(500).json({ error: "Failed to delete facility" });
		if (result.affectedRows === 0)
			return res.status(404).json({ error: "Facility not found" });
		res.json({ message: "Facility deleted successfully" });
	});
});

// API Endpoint to fetch facility details by ID
app.get("/facilities/:facilityId", (req, res) => {
	const facilityId = req.params.facilityId;

	const query = "SELECT * FROM Facility WHERE facility_id = ?";
	db.query(query, [facilityId], (err, results) => {
		if (err) {
			console.error("Error fetching facility details:", err);
			return res
				.status(500)
				.json({ error: "Failed to fetch facility details" });
		}

		if (results.length === 0) {
			return res.status(404).json({ error: "Facility not found" });
		}

		// Return the first facility object (since facility_id is unique)
		res.json(results[0]);
	});
});

app.put("/facilities/:facilityId", (req, res) => {
	const facilityId = req.params.facilityId;
	const {
		facility_name,
		location,
		phone_number,
		email,
		facility_type,
		max_storage_capacity,
	} = req.body;

	const query = `
        UPDATE Facility 
        SET facility_name = ?, location = ?, phone_number = ?, email = ?, facility_type = ?, max_storage_capacity = ?
        WHERE facility_id = ?
    `;

	db.query(
		query,
		[
			facility_name,
			location,
			phone_number,
			email,
			facility_type,
			max_storage_capacity,
			facilityId,
		],
		(err, result) => {
			if (err) {
				console.error("Error updating facility:", err);
				return res
					.status(500)
					.json({ error: "Failed to update facility" });
			}

			if (result.affectedRows === 0) {
				return res.status(404).json({ error: "Facility not found" });
			}

			res.json({ message: "Facility updated successfully" });
		}
	);
});

// Fetch all patients
app.get("/patients", (req, res) => {
	const sql = "SELECT patient_id, first_name, last_name FROM Patient";
	db.query(sql, (err, results) => {
		if (err) return res.status(500).json(err);
		res.json(results);
	});
});

// View a single patient's details
app.get("/patientsAdmin/:id", (req, res) => {
	const { id } = req.params;
	const sql = "SELECT * FROM Patient WHERE patient_id = ?";
	db.query(sql, [id], (err, results) => {
		if (err) return res.status(500).json(err);
		if (results.length === 0)
			return res.status(404).json({ message: "Patient not found" });
		res.json(results[0]);
	});
});

// Add a new patient
app.post("/patients", (req, res) => {
	const {
		first_name,
		last_name,
		date_of_birth,
		gender,
		blood_group,
		phone_number,
		email,
		address,
		password,
	} = req.body;

	const sql = `
        INSERT INTO Patient (
            first_name, 
            last_name, 
            date_of_birth, 
            gender, 
            blood_group, 
            phone_number, 
            email, 
            address, 
            password
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

	const values = [
		first_name,
		last_name,
		date_of_birth,
		gender,
		blood_group,
		phone_number,
		email,
		address,
		password,
	];
	db.query(sql, values, (err, result) => {
		if (err) return res.status(500).json({ error: err.message });
		res.json({
			message: "Patient added successfully",
			patient_id: result.insertId,
		});
	});
});

app.put("/patients/:id", (req, res) => {
	const { id } = req.params;
	const {
		first_name,
		last_name,
		date_of_birth,
		gender,
		blood_group,
		phone_number,
		email,
		address,
	} = req.body;

	const sql = `
        UPDATE Patient
        SET 
            first_name = ?, 
            last_name = ?, 
            date_of_birth = ?, 
            gender = ?, 
            blood_group = ?, 
            phone_number = ?, 
            email = ?, 
            address = ?
        WHERE patient_id = ?`;

	const values = [
		first_name,
		last_name,
		date_of_birth,
		gender,
		blood_group,
		phone_number,
		email,
		address,
		id,
	];

	db.query(sql, values, (err, result) => {
		if (err) return res.status(500).json(err);
		res.json({ message: "Patient details updated successfully" });
	});
});

// Delete a patient
app.delete("/patients/:id", (req, res) => {
	const { id } = req.params;
	const sql = "DELETE FROM Patient WHERE patient_id = ?";
	db.query(sql, [id], (err, result) => {
		if (err) return res.status(500).json(err);
		res.json({ message: "Patient deleted successfully" });
	});
});

// Get all health workers
app.get("/healthWorkersAdmin", (req, res) => {
	const sql =
		"SELECT health_worker_id, first_name, last_name FROM Health_Worker";
	db.query(sql, (err, results) => {
		if (err) return res.status(500).json(err);
		res.json(results);
	});
});

// Get health worker details by ID
app.get("/healthWorkers/:id", (req, res) => {
	const sql = "SELECT * FROM Health_Worker WHERE health_worker_id = ?";
	db.query(sql, [req.params.id], (err, results) => {
		if (err) return res.status(500).json(err);
		if (!results.length)
			return res.status(404).json({ message: "Health Worker not found" });
		res.json(results[0]);
	});
});

app.post("/healthWorkers", (req, res) => {
	const {
		health_worker_id,
		first_name,
		last_name,
		facility_id,
		phone_number,
		email,
		address,
		password,
	} = req.body;
	const sql = `
        INSERT INTO Health_Worker (health_worker_id, first_name, last_name, facility_id, phone_number, email, address, password)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
	db.query(
		sql,
		[
			health_worker_id,
			first_name,
			last_name,
			facility_id,
			phone_number,
			email,
			address,
			password,
		],
		(err, results) => {
			if (err) return res.status(500).json(err);
			res.json({ message: "Health Worker added successfully" });
		}
	);
});

// Update health worker details
app.put("/healthWorkers/:id", (req, res) => {
	const { first_name, last_name, facility_id, phone_number, email, address } =
		req.body;
	const sql = `
        UPDATE Health_Worker 
        SET first_name = ?, last_name = ?, facility_id = ?, phone_number = ?, email = ?, address = ?
        WHERE health_worker_id = ?`;
	db.query(
		sql,
		[
			first_name,
			last_name,
			facility_id,
			phone_number,
			email,
			address,
			req.params.id,
		],
		(err, results) => {
			if (err) return res.status(500).json(err);
			res.json({ message: "Health Worker updated successfully" });
		}
	);
});

// Delete a health worker
app.delete("/healthWorkers/:id", (req, res) => {
	const sql = "DELETE FROM Health_Worker WHERE health_worker_id = ?";
	db.query(sql, [req.params.id], (err, results) => {
		if (err) return res.status(500).json(err);
		res.json({ message: "Health Worker deleted successfully" });
	});
});

// Get all facility managers
app.get("/facilityManagersAdmin", (req, res) => {
	const sql =
		"SELECT facility_manager_id, first_name, last_name FROM Facility_Manager";
	db.query(sql, (err, results) => {
		if (err) return res.status(500).json(err);
		res.json(results);
	});
});

// Get facility manager details by ID
app.get("/facilityManagers/:id", (req, res) => {
	const sql = "SELECT * FROM Facility_Manager WHERE facility_manager_id = ?";
	db.query(sql, [req.params.id], (err, results) => {
		if (err) return res.status(500).json(err);
		if (!results.length)
			return res
				.status(404)
				.json({ message: "Facility Manager not found" });
		res.json(results[0]);
	});
});

// Add a new facility manager
app.post("/facilityManagers", (req, res) => {
	const {
		facility_manager_id,
		first_name,
		last_name,
		facility_id,
		phone_number,
		email,
		address,
		password,
	} = req.body;
	const sql = `
        INSERT INTO Facility_Manager (facility_manager_id, first_name, last_name, facility_id, phone_number, email, address, password)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
	db.query(
		sql,
		[
			facility_manager_id,
			first_name,
			last_name,
			facility_id,
			phone_number,
			email,
			address,
			password,
		],
		(err, results) => {
			if (err) return res.status(500).json(err);
			res.json({ message: "Facility Manager added successfully" });
		}
	);
});

// Update facility manager details
app.put("/facilityManagers/:id", (req, res) => {
	const { first_name, last_name, facility_id, phone_number, email, address } =
		req.body;
	const sql = `
        UPDATE Facility_Manager 
        SET first_name = ?, last_name = ?, facility_id = ?, phone_number = ?, email = ?, address = ?
        WHERE facility_manager_id = ?
    `;
	db.query(
		sql,
		[
			first_name,
			last_name,
			facility_id,
			phone_number,
			email,
			address,
			req.params.id,
		],
		(err, results) => {
			if (err) return res.status(500).json(err);
			res.json({ message: "Facility Manager updated successfully" });
		}
	);
});

// Delete a facility manager
app.delete("/facilityManagers/:id", (req, res) => {
	const sql = "DELETE FROM Facility_Manager WHERE facility_manager_id = ?";
	db.query(sql, [req.params.id], (err, results) => {
		if (err) return res.status(500).json(err);
		res.json({ message: "Facility Manager deleted successfully" });
	});
});

// Fetch inventory by facility manager
app.get("/inventory", (req, res) => {
	const facilityManagerId = req.query.facilityManagerId;
	const sql = `
        SELECT i.batch_number, v.vaccine_name, i.stock_quantity, i.expiry_date
        FROM Inventory i
        JOIN Vaccine v ON i.vaccine_id = v.vaccine_id
        JOIN Facility_Manager fm ON fm.facility_id = i.facility_id
        WHERE fm.facility_manager_id = ?
    `;
	db.query(sql, [facilityManagerId], (err, results) => {
		if (err) return res.status(500).json(err);
		res.json(results);
	});
});

// Fetch vaccine options
app.get("/vaccines", (req, res) => {
	const sql = "SELECT vaccine_id, vaccine_name FROM Vaccine";
	db.query(sql, (err, results) => {
		if (err) return res.status(500).json(err);
		res.json(results);
	});
});

app.post("/inventory", (req, res) => {
	const {
		batch_number,
		vaccine_id,
		stock_quantity,
		expiry_date,
		facilityManagerId,
	} = req.body;

	// Query to get the facility's max capacity and current total stock
	const capacityQuery = `
        SELECT f.max_storage_capacity, COALESCE(SUM(i.stock_quantity), 0) AS current_total_stock
        FROM Facility f
        LEFT JOIN Inventory i ON f.facility_id = i.facility_id
        INNER JOIN Facility_Manager fm ON f.facility_id = fm.facility_id
        WHERE fm.facility_manager_id = ?
        GROUP BY f.facility_id;
    `;

	db.query(capacityQuery, [facilityManagerId], (err, results) => {
		if (err) {
			console.error("Error fetching facility capacity:", err);
			return res.status(500).json({ error: "Database error" });
		}

		if (results.length === 0) {
			return res
				.status(404)
				.json({ error: "Facility not found for the given manager" });
		}

		const { max_storage_capacity, current_total_stock } = results[0];
		const newTotalStock =
			current_total_stock + parseInt(stock_quantity, 10);

		// Check if adding the new inventory exceeds the max capacity
		if (newTotalStock > max_storage_capacity) {
			return res.status(400).json({
				error: `Cannot add inventory. Exceeds max storage capacity of ${max_storage_capacity}. Current stock: ${current_total_stock}.`,
			});
		}

		// If within limits, proceed to add the inventory
		const insertQuery = `
            INSERT INTO Inventory (batch_number, vaccine_id, stock_quantity, expiry_date, facility_id)
            SELECT ?, ?, ?, ?, fm.facility_id
            FROM Facility_Manager fm WHERE fm.facility_manager_id = ?
        `;

		db.query(
			insertQuery,
			[
				batch_number,
				vaccine_id,
				stock_quantity,
				expiry_date,
				facilityManagerId,
			],
			(err, result) => {
				if (err) {
					console.error("Error adding inventory:", err);
					return res.status(500).json({ error: "Database error" });
				}
				res.status(201).json({
					message: "Inventory added successfully",
				});
			}
		);
	});
});

app.put("/inventory/:batchID", (req, res) => {
	const batchID = req.params.batchID;
	const { vaccine_id, stock_quantity, expiry_date } = req.body;

	const sql = `
        UPDATE 
            Inventory 
        SET 
            vaccine_id = ?, 
            stock_quantity = ?, 
            expiry_date = ? 
        WHERE 
            batch_number = ?
    `;

	db.query(
		sql,
		[vaccine_id, stock_quantity, expiry_date, batchID],
		(err, results) => {
			if (err) {
				console.error("Error updating inventory:", err);
				return res.status(500).json({ error: "Internal server error" });
			}

			if (results.affectedRows === 0) {
				return res
					.status(404)
					.json({ error: "Batch not found or no changes made" });
			}

			res.send("Inventory updated successfully");
		}
	);
});

// Delete inventory
app.delete("/inventory/:batchID", (req, res) => {
	const batchID = req.params.batchID;
	const sql = "DELETE FROM Inventory WHERE batch_number = ?";
	db.query(sql, [batchID], (err) => {
		if (err) return res.status(500).json(err);
		res.send("Inventory deleted");
	});
});

// In the '/inventoryFM/:batchID' endpoint:
app.get("/inventoryFM/:batchID", (req, res) => {
	const batchID = req.params.batchID;

	const sql = `
        SELECT 
            batch_number, 
            vaccine_id, 
            stock_quantity, 
            DATE_FORMAT(expiry_date, '%Y-%m-%d') AS expiry_date 
        FROM 
            Inventory 
        WHERE 
            batch_number = ?
    `;

	db.query(sql, [batchID], (err, results) => {
		if (err) {
			console.error("Error fetching inventory details:", err);
			return res.status(500).json({ error: "Internal server error" });
		}

		if (results.length === 0) {
			return res.status(404).json({ error: "Inventory batch not found" });
		}

		res.json(results[0]); // Send the inventory item as response
	});
});

app.get("/patientCheck/:id", (req, res) => {
	const patientId = req.params.id;

	const query = "SELECT * FROM Patient WHERE patient_id = ?";
	db.query(query, [patientId], (err, results) => {
		if (err) {
			console.error("Database error:", err);
			return res.status(500).json({ error: "Database error" });
		}

		if (results.length === 0) {
			return res.status(404).json({ message: "Patient not found" });
		}

		res.json({ message: "Patient exists", patient: results[0] });
	});
});

app.post("/inventory/check", (req, res) => {
	const { batchNumber, doseGiven } = req.body;

	const query = "SELECT stock_quantity FROM Inventory WHERE batch_number = ?";
	db.query(query, [batchNumber], (err, results) => {
		if (err) {
			console.error("Database error:", err);
			return res.status(500).json({ error: "Database error" });
		}

		if (results.length === 0) {
			return res.status(404).json({ error: "Batch not found" });
		}

		const availableStock = results[0].stock_quantity;
		if (availableStock < doseGiven) {
			return res.status(400).json({ error: "Insufficient stock" });
		}

		res.json({ message: "Sufficient stock available" });
	});
});

app.put("/patientsUpdate/:id", async (req, res) => {
	const { id } = req.params;
	const {
		first_name,
		last_name,
		date_of_birth,
		gender,
		phone_number,
		email,
		address,
	} = req.body;

	try {
		const query = `
            UPDATE Patient
            SET first_name = ?, last_name = ?, date_of_birth = ?, gender = ?, phone_number = ?, email = ?, address = ?
            WHERE patient_id = ?`;
		const values = [
			first_name,
			last_name,
			date_of_birth,
			gender,
			phone_number,
			email,
			address,
			id,
		];

		const [result] = await db.query(query, values);
		if (result.affectedRows > 0) {
			res.status(200).json({ message: "Profile updated successfully" });
		} else {
			res.status(404).json({ message: "Patient not found" });
		}
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Error updating profile" });
	}
});

app.get("/health-worker/least-appointments/:facilityId", (req, res) => {
	const { facilityId } = req.params;

	const parsedFacilityId = parseInt(facilityId, 10);
	if (isNaN(parsedFacilityId)) {
		return res.status(400).json({ error: "Invalid Facility ID" });
	}

	// Use a callback-based approach for mysql library
	db.query(
		"CALL GetHealthWorkerWithLeastAppointments(?)",
		[parsedFacilityId],
		(error, results, fields) => {
			if (error) {
				console.error("Database error:", error);
				return res.status(500).json({
					error: "Internal server error",
					details: error.message,
				});
			}

			// For stored procedures with mysql, results is typically a 2D array
			// First element contains the rows
			if (results && results[0] && results[0].length > 0) {
				res.status(200).json({
					healthWorkerId: results[0][0].health_worker_id,
				});
			} else {
				res.status(404).json({
					error: "No health workers available for the selected facility.",
				});
			}
		}
	);
});

// Get all vaccines
app.get("/vaccinesAdmin", (req, res) => {
	const query = "SELECT * FROM Vaccine";
	db.query(query, (err, results) => {
		if (err)
			return res.status(500).json({ error: "Failed to fetch vaccines" });
		res.json(results);
	});
});

// Add a vaccine
app.post("/vaccines", (req, res) => {
	const {
		vaccine_name,
		type,
		dosage_amount,
		required_doses,
		side_effects,
		storage_conditions,
	} = req.body;
	const query = `
        INSERT INTO Vaccine (vaccine_name, type, dosage_amount, required_doses, side_effects, storage_conditions)
        VALUES (?, ?, ?, ?, ?, ?)`;
	db.query(
		query,
		[
			vaccine_name,
			type,
			dosage_amount,
			required_doses,
			side_effects,
			storage_conditions,
		],
		(err) => {
			if (err)
				return res.status(500).json({ error: "Failed to add vaccine" });
			res.sendStatus(201);
		}
	);
});

// Get a specific vaccine
app.get("/vaccines/:id", (req, res) => {
	const { id } = req.params;
	const query = "SELECT * FROM Vaccine WHERE vaccine_id = ?";
	db.query(query, [id], (err, results) => {
		if (err)
			return res.status(500).json({ error: "Failed to fetch vaccine" });
		res.json(results[0]);
	});
});

// Update a vaccine
app.put("/vaccines/:id", (req, res) => {
	const { id } = req.params;
	const {
		vaccine_name,
		type,
		dosage_amount,
		required_doses,
		side_effects,
		storage_conditions,
	} = req.body;
	const query = `
        UPDATE Vaccine SET vaccine_name = ?, type = ?, dosage_amount = ?, required_doses = ?, side_effects = ?, storage_conditions = ?
        WHERE vaccine_id = ?`;
	db.query(
		query,
		[
			vaccine_name,
			type,
			dosage_amount,
			required_doses,
			side_effects,
			storage_conditions,
			id,
		],
		(err) => {
			if (err)
				return res
					.status(500)
					.json({ error: "Failed to update vaccine" });
			res.sendStatus(200);
		}
	);
});

// Delete a vaccine
app.delete("/vaccines/:id", (req, res) => {
	const { id } = req.params;
	const query = "DELETE FROM Vaccine WHERE vaccine_id = ?";
	db.query(query, [id], (err) => {
		if (err)
			return res.status(500).json({ error: "Failed to delete vaccine" });
		res.sendStatus(200);
	});
});

// Server setup
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
