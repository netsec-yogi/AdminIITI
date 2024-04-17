frappe.pages['leave-balance'].on_page_load = function(wrapper) {
	// var page = frappe.ui.make_app_page({
	// 	parent: wrapper,
	// 	title: 'Leave Balance',
	// 	single_column: true
	// });

	frappe.ui.make_app_page({
		parent: wrapper,
		title: __('Leave Balance')
	

	});

	let leave_balance = new LeaveBalance(wrapper);
	$(wrapper).bind('show', ()=> {
		leave_balance.show();
	});
}
class LeaveBalance{
	constructor(wrapper) {
		this.wrapper = $(wrapper);
		this.page = wrapper.page;
		this.sidebar = this.wrapper.find('.layout-side-section');
		this.main_section = this.wrapper.find('.layout-main-section');
		this.start = 0;
	}
	show(){
		
		this.sidebar.empty();

		let me = this;
		let employeeid;

		
		let employee_id = frappe.ui.form.make_control({
			parent: me.sidebar,
			df: {
				label: __('Select Employee'),
				fieldtype: 'Link',
				options: 'Employee',
				fieldname: 'employee_id',
				placeholder: __('Select Employee'),
				only_select: true,
				change: () => {

					employeeid = employee_id.get_value();
					me.employeeid = '';

					console.log(employeeid);
				
					if (employeeid) {
						me.start = 0;
						me.employeeid = employee_id.get_value();
						me.make_leave_balance_sheet();
					}
				}
		
			},
		});

		employee_id.refresh();
		
		this.sidebar.find('[data-fieldname="employee_id"]').append('<div class="employee-info"></div>');
	}
	make_leave_balance_sheet(){

		let date = new Date()
		let day = date.getDate();
		let month = date.getMonth()+1;
		let year = date.getFullYear();

		let fullDate = `${year}-${month}-${day}`;
		console.log(fullDate);

		let filters = {
			employee: this.employeeid,
			date: fullDate,
			page_length: 20
		};

		let me = this;
		frappe.call({
			'method': 'hrms.hr.doctype.leave_application.leave_application.get_leave_details',
			args: filters,
			callback: function(r) {
				let data = r.message;
				
				var data_length = Object.keys(data).length;

				console.log(data.leave_allocation)

				if (data_length) {
					
					me.main_section.empty().append(frappe.render_template('leave_balance',{'details':data}));
			
					//me.add_to_single_grade_sheet(data);
				} else {
					me.main_section.empty().append(frappe.render_template('leave_balance',{'details':data_length}));

				}

			}
		});
	}
}