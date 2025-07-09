// Copyright (c) 2025, CITC IIT Indore and contributors
// For license information, please see license.txt

frappe.ui.form.on('Note Sheet Approval Process', {
	// refresh: function(frm) {

	// }

	onload: function(frm) {
        // Ensure child table is empty initially
        if (!frm.doc.number_of_stage) {
            frm.clear_table("approval_stage");
            frm.refresh_field("approval_stage");
        }
    },

    refresh: function(frm) {
        hide_add_row_button(frm);
    },

    number_of_stage: function(frm) {
        let num_stages = cint(frm.doc.number_of_stage || 0); // Convert to integer, default to 0 if empty

        // If field is empty, clear child table
        if (!num_stages) {
            frm.clear_table("approval_stage");
            frm.refresh_field("approval_stage");
            hide_add_row_button(frm);
            return; // Stop execution to avoid adding rows
        }

        // Clear existing rows before adding new ones
        frm.clear_table("approval_stage");

        for (let i = 0; i < num_stages; i++) {
            let row = frm.add_child("approval_stage");
            row.status = "Open"; // Default status
        }

        frm.refresh_field("approval_stage");
        if(frappe.session.user != 'Administrator'){
            hide_add_row_button(frm);
        }
        // Hide Add Row after updating
    }
});

// Function to hide the Add Row button instantly
function hide_add_row_button(frm) {
    //frm.fields_dict['approval_stage'].grid.wrapper.find('.grid-add-row').remove();
    //frm.fields_dict['approval_stage'].grid.wrapper.find('.grid-footer').remove();
}


frappe.ui.form.on('Approval Stage', {
    approver_email: function(frm, cdt, cdn) {
        var row = locals[cdt][cdn];

        if (row.approver_email) {
            let approver_details = get_approver_data(row.approver_email);
            
            if (approver_details) {
                row.department = approver_details.department || '';
                row.designation = approver_details.designation || '';
                frm.refresh_field('approval_stage');
            }
        }
    }
});

function get_approver_data(user) {
    let details = '';

    frappe.call({
        method: 'admin_iiti.admin_iiti.doctype.note_sheet_approval_process.note_sheet_approval_process.get_employee_data',
        args: {
            user_id: user
        },
        async: false,  // Ensures data is returned before continuing
        callback: function(r) {
            if (r && r.message) {
                details = r.message;
            }
        }
    });

    return details;
}
