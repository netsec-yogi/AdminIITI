// Copyright (c) 2023, CITC IIT Indore and contributors
// For license information, please see license.txt

frappe.ui.form.on('LTC Office Memorandum', {
	// refresh: function(frm) {

	// }
	onload:function(frm){
		cur_frm.fields_dict.ltc_reference_number.get_query = function(doc) {
			return {
				filters: {
					status: 'Sanction',
				},
				order_by: 'creation desc',
			}
		}
	},
	ltc_reference_number:function(frm){
		if(frm.doc.ltc_reference_number){
			ltc_details(frm);
		}
		// supplier_details(frm);
	},
});
function ltc_details(document){
	frappe.call({
		"method": "frappe.client.get",
		"args": {
			"doctype": "LTC Request",
			"name": document.doc.ltc_reference_number
		},
		callback: function (r) {
			var data = r.message;
			console.log(data);
			if(data.ltc_claimed.length>0){
				cur_frm.clear_table('ltc_claimed');
				$.each(data.ltc_claimed, function (i, d) {
					var val = document.add_child('ltc_claimed');
					val.family_members = d.family_members,
					val.age =d.age,
					val.relationship = d.relationship,
					val.from_date = d.from_date,
					val.to_date = d.to_date
				});
			}else{
				cur_frm.clear_table('ltc_claimed');
			}
			refresh_field('item');
			document.set_value('application_date',data.creation);
			frappe.db.get_value('Employee', {'name': data.employee}, 'designation', (d) =>{
				document.set_value("designation",d.designation);
			})
			refresh_field('ltc_claimed');
			
		}
	})
}
