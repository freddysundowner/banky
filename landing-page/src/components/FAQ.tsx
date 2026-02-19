const faqs = [
  {
    question: 'Is BANKY right for my chama or small group?',
    answer: 'Absolutely. Whether you have 15 members or 15,000, BANKY scales with you. Chamas love the loan tracking, savings accounts, M-Pesa integration, and automated dividend sharing -- no more WhatsApp spreadsheets.',
  },
  {
    question: 'How is BANKY different from a spreadsheet?',
    answer: 'Spreadsheets break when you grow. BANKY gives you real-time dashboards, automatic interest calculations, M-Pesa integration, SMS notifications, audit trails, and proper double-entry accounting -- all without manual data entry.',
  },
  {
    question: 'What is the difference between SaaS and Enterprise?',
    answer: 'SaaS is hosted by us -- you log in and start using it immediately with monthly billing. Enterprise is a one-time purchase where you install BANKY on your own servers for full control. Both have the same powerful features.',
  },
  {
    question: 'Does BANKY work with M-Pesa?',
    answer: 'Yes. Members can deposit, repay loans, and receive disbursements directly via M-Pesa STK Push. Transactions reconcile automatically -- no manual entry needed.',
  },
  {
    question: 'Is my data safe and private?',
    answer: 'Every organization gets its own isolated database -- your data is never shared or mixed with anyone else\'s. We use bank-grade encryption, role-based access control, and maintain detailed audit logs of every action.',
  },
  {
    question: 'Can I switch from SaaS to Enterprise later?',
    answer: 'Yes. We can migrate your entire database and member records from our cloud platform to your own self-hosted Enterprise installation whenever you are ready.',
  },
  {
    question: 'Do you offer training and support?',
    answer: 'All plans include online training and email support. Growth and Professional plans get priority support. Enterprise customers can request on-site training and a dedicated account manager.',
  },
  {
    question: 'What reports can I generate for regulators?',
    answer: 'BANKY generates Trial Balance, Income Statement, Balance Sheet, loan portfolio reports, member statements, and transaction summaries -- all exportable to CSV or PDF with a single click.',
  },
  {
    question: 'How quickly can we go live?',
    answer: 'Most organizations sign up and process their first transaction within an hour. Larger Saccos migrating historical data typically go live within a week with our support team\'s help.',
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
            FAQ
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Got Questions? We Have Answers.
          </h2>
          <p className="text-xl text-gray-600">
            Everything you need to know before getting started
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {faqs.map((faq) => (
            <div key={faq.question} className="bg-white p-6 rounded-xl border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{faq.question}</h3>
              <p className="text-gray-600">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
