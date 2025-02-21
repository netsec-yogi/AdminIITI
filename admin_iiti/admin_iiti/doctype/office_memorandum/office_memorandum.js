// Copyright (c) 2025, CITC IIT Indore and contributors
// For license information, please see license.txt

frappe.ui.form.on('Office Memorandum', {
	// refresh: function(frm) {

	// }
	notesheet_name:function(frm){
		frm.set_query("document_name", function() {
			return {
				doctype: frm.doc.notesheet_name, // Dynamically fetch from selected Doctype
				filters: {'status':'Approved'},
				fields: ["name", "employee_name", "department"], // Fetch only required fields
				limit_page_length: 20 // Limit the number of results
			};
		});
	}
});
