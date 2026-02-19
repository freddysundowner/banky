const faqs = [
  {
    question: 'What is the difference between SaaS and Enterprise?',
    answer: 'SaaS is hosted by us with monthly billing. Enterprise is a one-time purchase where you host it on your own servers with full control.',
  },
  {
    question: 'Can I switch from SaaS to Enterprise later?',
    answer: 'Yes! We can help you migrate your data from our SaaS platform to your own self-hosted Enterprise installation.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Absolutely. Each organization gets its own isolated database. We use encryption at rest and in transit, with regular backups.',
  },
  {
    question: 'Do you offer training?',
    answer: 'Yes, we provide online training for all plans and on-site training for Enterprise customers.',
  },
  {
    question: 'What payment methods are supported?',
    answer: 'M-Pesa, bank transfers, and card payments. Enterprise customers can pay via invoice.',
  },
  {
    question: 'Can I customize the system?',
    answer: 'Enterprise customers get full source code access. We also offer custom development services.',
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
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
            Frequently Asked Questions
          </h2>
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
