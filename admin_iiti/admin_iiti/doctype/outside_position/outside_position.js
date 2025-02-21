// Copyright (c) 2025, CITC IIT Indore and contributors
// For license information, please see license.txt

frappe.ui.form.on('Outside Position', {
	// refresh: function(frm) {

	// }
	refresh: function(frm) {
        // Inject CSS dynamically
        frappe.require("/assets/admin_iiti/css/custom.css");
    },

	employee: function(frm) {
        if (frm.doc.employee) {
            // 🔹 Step 1: Reset all fields before fetching new data
            let fields = ['employee_name', 'designation', 'department', 'date_of_joining', 'user_id'];
            fields.forEach(field => {
                frm.set_value(field, null);
                frm.set_df_property(field, 'read_only', 0);
                frm.set_df_property(field, 'hidden', 0);
            });

            // 🔹 Step 2: Fetch New Employee Data
            frappe.call({
                method: "frappe.client.get",
                args: {
                    doctype: "Employee",
                    name: frm.doc.employee
                },
                callback: function(r) {
                    if (r.message) {
                        fields.forEach(field => {
                            if (r.message[field]) {
                                // Autofill & Make Read-Only
                                frm.set_value(field, r.message[field]);
                                frm.set_df_property(field, 'read_only', 1);
                            } else {
                                // Keep Editable if No Data
                                frm.set_df_property(field, 'read_only', 0);
                            }
                        });

						frm.set_df_property('user_id', 'hidden', 1);
                    }
                }
            });
        } else {
            // 🔹 If no employee is selected, clear all fields
            fields.forEach(field => frm.set_value(field, null));
        }
    },

	reporting_officer_name: function (frm) {
        if (frm.doc.reporting_officer_name) {
            // Step 1: Get the user_id (email) from the selected User
            frappe.db.get_value('User', {'name': frm.doc.reporting_officer_name}, 'user_id', function(user) {
                if (user && user.user_id) {
                    let reporting_officer_email = user.user_id;

                    // Step 2: Fetch Employee details where user_id matches
                    frappe.db.get_value('Employee', {'user_id': reporting_officer_email}, 
                        ['designation', 'department', 'cell_number'], function(employee) {

                        if (employee) {
                            frm.set_value('reporting_officer_designation', employee.designation || '');
                            frm.set_value('reporting_officer_department', employee.department || '');
                            frm.set_value('reporting_officer_contact', employee.cell_number || '');
                        }
                    });
                }
            });
        }
    }
});
