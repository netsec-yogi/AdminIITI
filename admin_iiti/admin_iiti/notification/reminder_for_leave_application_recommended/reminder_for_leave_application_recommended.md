<!-- <table class="panel-header" border="0" cellpadding="0" cellspacing="0" width="100%">
	<tr>
		<td width="15"></td>
		<td>
		
		</td>
		<td width="15"></td>
	</tr>
	<tr height="10"></tr>
</table> -->

<div class="text-medium text-muted" style="color:#202124;">
	<h2>{{_("Reminder to recommend The Leave Appliction:")}}</h2>
</div>

<table class="panel-body" border="" cellpadding="0" cellspacing="" width="100%">
	<tr height="10">
        <td> <b>{{_("Employee")}}: </b></td>
        <td>{{doc.employee_name}}</td>
    </tr>
    <tr height="10">
        <td> <b>{{_("Leave Type")}}: </b></td>
        <td>{{doc.leave_type}}</td>
    </tr>
    <tr height="10">
        <td> <b>{{_("From Date")}}: </b></td>
        <td>{{doc.from_date}}</td>
    </tr>
    <tr height="10">
        <td> <b>{{_("To Date")}}: </b></td>
        <td>{{doc.to_date}}</td>
    </tr>
    <tr height="10">
        <td> <b>{{_("Total Leave Days")}}: </b></td>
        <td>{{doc.total_leave_days}}</td>
    </tr>
    <tr>
        <td><b>{{_("Status")}}: </b></td>
        <td>{{doc.status}}</td>
    </tr>
    {% set doc_link = frappe.utils.get_url_to_form('Leave Application', doc.name) %}
	<!-- <tr>
		<td width="15"></td>
		<td>
			<div>
				<ul class="list-unstyled" style="line-height: 1.7">
					<li><b>{{_("Employee")}}: </b>{{ doc.employee }} - {{ doc.employee_name }}</li>
					<li><b>{{_("Date")}}: </b>{{ frappe.utils.formatdate(doc.date) }}</li>
					<li><b>{{_("Interviewers")}}:</b> </li>
					{% for entry in doc.interviewers %}
						<ul>
							<li>{{ entry.user }}</li>
						</ul>
					{% endfor %}
					<li><b>{{ _("Interview Document") }}:</b> {{ frappe.utils.get_link_to_form(doc.doctype, doc.name) }}</li>
				</ul>
			</div>
		</td>
		<td width="15"></td>
	</tr> -->
</table>
<div class="text-medium text-muted" style="color:#202124;">
	<h2>Please click on the button below and recommend or Not recommend the leave application</h2>
</div>
<div class="col-md-6">
<a href="{{doc_link}}" style="color:#fff;background-color:#2490ef;border:1px solid;border-color:transparent;border-radius:6px;display:inline-block;font-size:13px;line-height:20px;padding:4px 20px;text-decoration:none" bgcolor="#2490EF" target="_blank" >Open Now</a>

</div>