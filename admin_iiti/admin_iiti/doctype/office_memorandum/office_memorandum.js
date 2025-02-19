// Copyright (c) 2025, CITC IIT Indore and contributors
// For license information, please see license.txt

frappe.ui.form.on('Office Memorandum', {
	// refresh: function(frm) {

	// }
	
	notesheet_name: function(frm) {
        if (frm.doc.notesheet_name) {

             // Set a dynamic query for document_name field
             frm.set_query("document_name", function() {
                return {
                    doctype: frm.doc.notesheet_name, // Dynamically fetch from selected Doctype
                    //filters: {'status':'Approved'},
                    fields: ["name", "employee_name", "department"], // Fetch only required fields
                    limit_page_length: 20 // Limit the number of results
                };
            });
            // frappe.call({
            //     method: 'frappe.client.get_list',
            //     args: {
            //         doctype: frm.doc.notesheet_name, // Get data from selected Doctype
            //         fields: ['name', 'employee_name', 'department', 'department'], // Fetch only required fields
            //         // limit_page_length: 10 // Limit number of results
            //     },
            //     callback: function(response) {
			// 		console.log("mes",response.message);
					
            //         if (response.message) {
            //             let options = response.message.map(row => 
			// 				`${row.name} ( ${row.employee_name} ) ( ${row.department})`
			// 			).join('\n');
            //             frm.set_df_property('document_name', 'options', options);
            //             frm.refresh_field('document_name');
            //         }
            //     }
            // });
        }
    }
});
