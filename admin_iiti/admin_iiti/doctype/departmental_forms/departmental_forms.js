// Copyright (c) 2023, CITC IIT Indore and contributors
// For license information, please see license.txt

frappe.ui.form.on('Departmental Forms', {
	refresh: function(frm) {
		let logged_user = frappe.session.user;
		if(!frm.is_new()){
			//Comment p: save button hide and show session login user
			if(frm.doc.owner == frappe.session.user){
				frm.enable_save();
			}else{
				frm.disable_save();
			}
		}
		//Comment p: Approver user recommended and reject button show and hide 
		let approver_details = frm.doc.approver_details;
		if(approver_details){
			approver_details.forEach(function (list) {
				if(list.approver == logged_user && list.status == 'Open' && frm.doc.status != 'Recommended' ){
					frm.add_custom_button(__('Recommend'), function(){
						let action_type = 'Recommended';
						change_form_status(frm,action_type,logged_user,list.idx);
					}).addClass("btn-info").css({'color':'#ffffff','font-weight': 'bold','background-color': '#6495ed'})
			
					frm.add_custom_button(__('Reject'), function(){
						let action_type = 'Rejected';	
						change_form_status(frm,action_type,logged_user,list.idx);
				
					}).addClass("btn-danger").css({'color':'#ffffff','font-weight': 'bold','background-color': 'red'})
				}
				if(list.approver == logged_user && list.status == 'Open' && frm.doc.status == 'Recommended'){
					frm.add_custom_button(__('Approve'), function(){
						let action_type = 'Approved';
						change_form_status(frm,action_type,logged_user,list.idx);
					}).addClass("btn-info").css({'color':'#ffffff','font-weight': 'bold','background-color': '#6495ed'})
		
					frm.add_custom_button(__('Reject'), function(){
						let action_type = 'Rejected';	
						change_form_status(frm,action_type,logged_user,list.idx);
				
					}).addClass("btn-danger").css({'color':'#ffffff','font-weight': 'bold','background-color': 'red'})
				}

				if(list.approver == logged_user && list.status == 'Recommended'){

					frm.add_custom_button(__('Recommended'), function(){
						
						frappe.msgprint('Recommend status alredy updated');
				
					}).addClass("btn-info").css({'color':'#ffffff','font-weight': 'bold','background-color': '#1eb817ab'})
				}

				//if(logged_user != list.approver){
					//list.docstatus = 1;
				//}
			})

		}
	}
});
// Approver Details fetch function call
frappe.ui.form.on('Approvers', 'approver', function(frm,cdt,cdn) {
	var val = locals[cdt][cdn];

	frm.refresh_field("approver_details");
	let approver_details = approver_data(val.approver);
	let full_name = approver_details.salutation +'.'+approver_details.employee_name
	if(full_name){
		val.approver_name = full_name;
	}else{
		val.approver_name = '';
	}
	val.department = approver_details.department;
	val.designation = approver_details.designation;
	
	frm.refresh_field("approver_details");

});
// Approver Details fetch function call
function approver_data(user){
	let details = ''
	frappe.call({
		"method": 'admin_iiti.approver_share.get_employee_data',
		"args": {
			"user_id": user,
		},
		"async": false,
		callback: function (r) {
			let  data = r.message;
			if (r && r.message) {
				details = data;	
			}
		}
	});
	return details;

}

function change_form_status(frm,action_type,approver_user,approved_count) {
	frappe.call({
		"method": 'admin_iiti.approver_share.change_status',
		"args": {
			"document_name": frm.doc.name,
			"status":action_type,
			"user":approver_user,
			"approved_count":approved_count,
			"total_approver_count" :frm.doc.approver_details.length,
			"doctype_name":frm.doc.doctype,
		},
		"async": false,
		callback: function (r) {
			let data = r.message
			console.log('data',data);
			frm.set_value('approved_count',approved_count)
			if(data == 'Open'){
				frm.set_value('status','Open');
				let child_doc_status = action_type
				change_child_approver_status(frm,child_doc_status)
				cur_frm.save();
				
			}else if(data == 'Recommend'){
				frm.set_value('status','Recommended')
				let child_doc_status = action_type
				change_child_approver_status(frm,child_doc_status)
				cur_frm.save();
			}else if(data == 'Approved'){
				frm.set_value('status','Approved');
				let child_doc_status = action_type;
				change_child_approver_status(frm,child_doc_status)
				cur_frm.savesubmit();

			}else if(data == 'Rejected'){
				frm.set_value('status','Rejected');
				let child_doc_status = action_type;
				change_child_approver_status(frm,child_doc_status)
				cur_frm.save();
			}
			//cur_frm.reload_doc();
		}
	});
}

function change_child_approver_status(frm,child_doc_status){
	let datetime = frappe.datetime.now_datetime();
	frm.refresh_field("approver_details");
	let approver_details = frm.doc.approver_details;
	if(approver_details.length>0){
		approver_details.forEach(function (i, d) {
			if(i.approver == frappe.session.user && i.status == 'Open'){
				var val = approver_details[d];
				val.status = child_doc_status;
				val.status_change_date_time = datetime;
				val.docstatus = 1;
			}
		})
	}else{
		cur_frm.clear_table('approver_details');
	}
}
