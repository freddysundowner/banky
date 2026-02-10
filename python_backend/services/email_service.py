import httpx
import logging
import base64
from io import BytesIO
from typing import Optional, List
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from pypdf import PdfReader, PdfWriter

logger = logging.getLogger(__name__)


def encrypt_pdf(pdf_bytes: bytes, password: str) -> bytes:
    """Encrypt a PDF with a password"""
    reader = PdfReader(BytesIO(pdf_bytes))
    writer = PdfWriter()
    
    for page in reader.pages:
        writer.add_page(page)
    
    writer.encrypt(password)
    
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def generate_payslip_pdf(
    staff_name: str,
    org_name: str,
    payslip_data: dict,
    password: Optional[str] = None
) -> bytes:
    """Generate a professional PDF payslip"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20*mm,
        leftMargin=20*mm,
        topMargin=20*mm,
        bottomMargin=20*mm
    )
    
    elements = []
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#1e40af'),
        alignment=TA_CENTER,
        spaceAfter=6
    )
    
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.gray,
        alignment=TA_CENTER,
        spaceAfter=20
    )
    
    section_header = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.HexColor('#1e40af'),
        spaceAfter=10,
        spaceBefore=15
    )
    
    elements.append(Paragraph(org_name, title_style))
    elements.append(Paragraph(f"PAYSLIP - {payslip_data['pay_period']}", subtitle_style))
    
    employee_data = [
        ['Employee Name:', staff_name, 'Pay Period:', payslip_data['pay_period']],
    ]
    
    employee_table = Table(employee_data, colWidths=[100, 150, 100, 150])
    employee_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.gray),
        ('TEXTCOLOR', (2, 0), (2, -1), colors.gray),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(employee_table)
    elements.append(Spacer(1, 20))
    
    elements.append(Paragraph("EARNINGS", section_header))
    
    earnings_data = [
        ['Description', f"Amount ({payslip_data.get('currency', 'KES')})"],
        ['Basic Salary', f"{payslip_data['basic_salary']:,.2f}"],
        ['House Allowance', f"{payslip_data['house_allowance']:,.2f}"],
        ['Transport Allowance', f"{payslip_data['transport_allowance']:,.2f}"],
        ['Other Allowances', f"{payslip_data['other_allowances']:,.2f}"],
        ['GROSS SALARY', f"{payslip_data['gross_salary']:,.2f}"],
    ]
    
    earnings_table = Table(earnings_data, colWidths=[350, 150])
    earnings_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, -2), 'Helvetica'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#dbeafe')),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(earnings_table)
    
    elements.append(Paragraph("DEDUCTIONS", section_header))
    
    deductions_data = [
        ['Description', f"Amount ({payslip_data.get('currency', 'KES')})"],
        ['NHIF', f"{payslip_data['nhif_deduction']:,.2f}"],
        ['NSSF', f"{payslip_data['nssf_deduction']:,.2f}"],
        ['PAYE Tax', f"{payslip_data['paye_tax']:,.2f}"],
        ['Loan Deductions', f"{payslip_data['loan_deductions']:,.2f}"],
        ['Other Deductions', f"{payslip_data['other_deductions']:,.2f}"],
        ['TOTAL DEDUCTIONS', f"{payslip_data['total_deductions']:,.2f}"],
    ]
    
    deductions_table = Table(deductions_data, colWidths=[350, 150])
    deductions_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, -2), 'Helvetica'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#dc2626')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#fef2f2')),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(deductions_table)
    
    elements.append(Spacer(1, 20))
    
    net_data = [
        ['NET SALARY', f"{payslip_data.get('currency', 'KES')} {payslip_data['net_salary']:,.2f}"],
    ]
    
    net_table = Table(net_data, colWidths=[350, 150])
    net_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 14),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#22c55e')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
    ]))
    elements.append(net_table)
    
    elements.append(Spacer(1, 30))
    
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.gray,
        alignment=TA_CENTER
    )
    elements.append(Paragraph(
        f"This is a computer-generated payslip from {org_name}. No signature required.",
        footer_style
    ))
    
    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    
    # Apply password protection if password provided
    if password:
        pdf_bytes = encrypt_pdf(pdf_bytes, password)
    
    return pdf_bytes


class BrevoEmailService:
    """Brevo (formerly Sendinblue) email service"""
    
    BASE_URL = "https://api.brevo.com/v3"
    
    def __init__(self, api_key: str, from_name: str, from_email: str):
        self.api_key = api_key
        self.from_name = from_name
        self.from_email = from_email
    
    async def send_email(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        html_content: Optional[str] = None,
        text_content: Optional[str] = None,
        cc_email: Optional[str] = None,
        attachments: Optional[List[dict]] = None
    ) -> dict:
        """Send email via Brevo API with optional attachments"""
        if not self.api_key:
            raise ValueError("Brevo API key not configured")
        
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        payload = {
            "sender": {
                "name": self.from_name,
                "email": self.from_email
            },
            "to": [
                {
                    "email": to_email,
                    "name": to_name
                }
            ],
            "subject": subject
        }
        
        if cc_email:
            payload["cc"] = [{"email": cc_email}]
        
        if html_content:
            payload["htmlContent"] = html_content
        if text_content:
            payload["textContent"] = text_content
        
        if attachments:
            payload["attachment"] = attachments
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/smtp/email",
                headers=headers,
                json=payload,
                timeout=30.0
            )
            
            if response.status_code == 201:
                logger.info(f"Email sent successfully to {to_email}")
                return {"success": True, "message_id": response.json().get("messageId")}
            else:
                error_msg = response.text
                logger.error(f"Failed to send email: {response.status_code} - {error_msg}")
                raise Exception(f"Email send failed: {error_msg}")


def get_email_settings(tenant_session) -> dict:
    """Get email settings from tenant database"""
    from models.tenant import OrganizationSettings
    
    settings = {}
    keys = ["email_enabled", "email_provider", "brevo_api_key", "email_from_name", "email_from_address"]
    
    for key in keys:
        setting = tenant_session.query(OrganizationSettings).filter(
            OrganizationSettings.setting_key == key
        ).first()
        if setting:
            settings[key] = setting.setting_value
    
    return settings


async def send_payslip_email(
    tenant_session,
    staff_email: str,
    staff_name: str,
    org_name: str,
    payslip_data: dict,
    cc_email: Optional[str] = None,
    national_id: Optional[str] = None
) -> dict:
    """Send payslip email to staff member with password-protected PDF attachment"""
    settings = get_email_settings(tenant_session)
    
    if settings.get("email_enabled") != "true":
        raise ValueError("Email notifications are not enabled")
    
    api_key = settings.get("brevo_api_key", "")
    from_name = settings.get("email_from_name", org_name)
    from_email = settings.get("email_from_address", "")
    
    if not api_key or not from_email:
        raise ValueError("Email settings not configured. Please configure Brevo API key and sender email in Settings.")
    
    service = BrevoEmailService(api_key, from_name, from_email)
    
    # Password protection is required - fail if national_id not provided
    if not national_id:
        raise ValueError("National ID is required for password-protected payslip. Please ensure staff profile has National ID configured.")
    
    # Generate PDF with password protection using national_id
    pdf_bytes = generate_payslip_pdf(staff_name, org_name, payslip_data, password=national_id)
    pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
    
    pay_period_safe = payslip_data['pay_period'].replace(' ', '_').replace('/', '-')
    filename = f"Payslip_{pay_period_safe}_{staff_name.replace(' ', '_')}.pdf"
    
    attachments = [{
        "content": pdf_base64,
        "name": filename
    }]
    
    # Build email content - simplified with just instructions for opening password-protected document
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1e40af; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">{org_name}</h1>
        </div>
        
        <div style="padding: 20px;">
            <p>Dear <strong>{staff_name}</strong>,</p>
            <p>Your payslip for <strong>{payslip_data['pay_period']}</strong> is attached to this email.</p>
            
            <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #f59e0b;">
                <p style="margin: 0 0 10px 0; color: #92400e; font-weight: bold; font-size: 16px;">How to Open Your Payslip</p>
                <ol style="margin: 0; padding-left: 20px; color: #78350f;">
                    <li style="margin-bottom: 8px;">Download the attached PDF file</li>
                    <li style="margin-bottom: 8px;">Open the PDF using any PDF reader (Adobe Reader, Chrome, etc.)</li>
                    <li style="margin-bottom: 8px;">When prompted for password, enter your <strong>National ID Number</strong></li>
                </ol>
                <p style="margin: 15px 0 0 0; color: #92400e; font-size: 13px;">
                    <em>For security, your payslip is password-protected with your National ID number.</em>
                </p>
            </div>
            
            <p style="color: #666; font-size: 12px; margin-top: 30px;">
                This is an automated message from {org_name}. Please do not reply to this email.<br>
                If you have any questions about your payslip, please contact HR.
            </p>
        </div>
    </body>
    </html>
    """
    
    text_content = f"""
Dear {staff_name},

Your payslip for {payslip_data['pay_period']} is attached to this email.

HOW TO OPEN YOUR PAYSLIP:
1. Download the attached PDF file
2. Open the PDF using any PDF reader (Adobe Reader, Chrome, etc.)
3. When prompted for password, enter your National ID Number

For security, your payslip is password-protected with your National ID number.

This is an automated message from {org_name}. Please do not reply to this email.
If you have any questions about your payslip, please contact HR.
    """
    
    subject = f"Payslip for {payslip_data['pay_period']} - {org_name}"
    
    return await service.send_email(
        to_email=staff_email,
        to_name=staff_name,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        cc_email=cc_email,
        attachments=attachments
    )
