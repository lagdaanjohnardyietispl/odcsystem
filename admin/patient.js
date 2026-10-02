// Renamed from 'table' to 'patientRecordTable' to prevent crashing script.js
const patientRecordTable = document.getElementById("patientTable").querySelector("tbody");
const confirmAllButton = document.getElementById("confirmAllPatients");

// Renamed to 'patientRecordsList'
let patientRecordsList = JSON.parse(localStorage.getItem("patients")) || [];

const computeTotalPrice = text =>
    String(text || "")
        .split(/\r?\n/)
        .reduce((sum, line) => {
            let price = parseFloat(line.split(":")[1]) || 0;
            return sum + price;
        }, 0);

async function syncPatientRecord(patient, items, price) {
    const { data, error } = await supabaseClient
        .from("appointments")
        .update({
            items_used: items.value.trim(),
            price: parseFloat(price.value)
        })
        .eq("client_name", patient.client_name)
        .eq("phone", patient.phone)
        .eq("appointment_date", patient.appointment_date)
        .eq("appointment_time", patient.appointment_time);

    if (error) {
        console.error("Error saving to Supabase:", error);
    }
}

function renderPatients(records) {
    // Clear existing rows
    patientRecordTable.innerHTML = '';

    records.forEach((p, i) => {
        let row = patientRecordTable.insertRow();
        row.className = "data-row";

        [p.client_name, p.phone, p.appointment_date, p.appointment_time, p.treatment]
            .forEach(v => row.insertCell().textContent = v);

        let itemsCell = row.insertCell();
        let actionCell = row.insertCell();

        let items = document.createElement("textarea");
        items.className = "patient-items-input";
        items.rows = 3;
        items.value = p.items_used || "";

        let price = document.createElement("input");
        price.type = "number";
        price.readOnly = true;
        price.className = "patient-price-input";
        price.value = p.price || computeTotalPrice(items.value).toFixed(2);

        items.oninput = () =>
            price.value = computeTotalPrice(items.value).toFixed(2);

        let btn = document.createElement("button");
        btn.textContent = "Confirm";
        btn.className = "confirm-record-button";
        btn.onclick = async () => {
            p.items_used = items.value.trim();
            p.price = price.value;
            localStorage.setItem("patients", JSON.stringify(records));
            
            await syncPatientRecord(p, items, price);
            
            btn.textContent = "Saved";
            setTimeout(() => btn.textContent = "Confirm", 1200);
        };

        itemsCell.append(items, price);
        actionCell.append(btn);
    });
}

// Renamed from 'loadPatients' to prevent overwriting the function in script.js
async function loadPatientRecords() {
    try {
        const { data, error } = await supabaseClient
            .from("appointments")
            .select("client_name, phone, appointment_date, appointment_time, treatment, items_used, price")
            .order("appointment_date", { ascending: true })
            .order("appointment_time", { ascending: true });

        if (error) {
            throw error;
        }

        if (data && Array.isArray(data)) {
            patientRecordsList = data;
            localStorage.setItem("patients", JSON.stringify(data));
        }
    } catch (err) {
        console.error("Failed to load patients from Supabase:", err);
    }
    
    renderPatients(patientRecordsList);
}

// Trigger the load
loadPatientRecords();

// Handle "Confirm All Changes" button
confirmAllButton?.addEventListener("click", () => {
    patientRecordTable.querySelectorAll(".data-row").forEach((row, i) => {
        let items = row.querySelector(".patient-items-input");
        let price = row.querySelector(".patient-price-input");
        
        if (!patientRecordsList[i]) return;
        
        patientRecordsList[i].items_used = items.value.trim();
        patientRecordsList[i].price = price.value;
        syncPatientRecord(patientRecordsList[i], items, price);
    });

    localStorage.setItem("patients", JSON.stringify(patientRecordsList));
});