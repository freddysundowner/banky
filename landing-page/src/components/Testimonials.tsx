import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    name: 'James Mwangi',
    role: 'Chairman',
    organization: 'Ukulima Sacco',
    quote: 'BANKY transformed how we manage our 5,000+ members. Loan processing that used to take days now takes minutes. The M-Pesa integration alone saved us countless hours.',
    rating: 5,
  },
  {
    name: 'Grace Achieng',
    role: 'General Manager',
    organization: 'Boresha Sacco',
    quote: 'We switched from spreadsheets to BANKY and the difference is night and day. The accounting module with automatic journal entries has eliminated human errors completely.',
    rating: 5,
  },
  {
    name: 'Peter Kamau',
    role: 'IT Manager',
    organization: 'Wekeza Investment Sacco',
    quote: 'The multi-tenant architecture gives us peace of mind knowing our data is completely isolated. Setup was straightforward and the support team is excellent.',
    rating: 5,
  },
  {
    name: 'Faith Njeri',
    role: 'Operations Director',
    organization: 'Fanaka Savings Sacco',
    quote: 'The teller station and float management features are exactly what we needed. Our tellers can now process transactions quickly with full accountability.',
    rating: 4,
  },
  {
    name: 'David Ochieng',
    role: 'CEO',
    organization: 'Pamoja Microfinance',
    quote: 'We evaluated several systems before choosing BANKY. The dividend calculation and fixed deposit modules set it apart. It handles everything we need under one roof.',
    rating: 5,
  },
  {
    name: 'Sarah Wambui',
    role: 'Finance Manager',
    organization: 'Umoja Community Sacco',
    quote: 'The analytics dashboard gives our board real-time visibility into performance. Generating reports for regulators is now a one-click process instead of a week-long exercise.',
    rating: 5,
  },
];

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('');
}

const bgColors = [
  'bg-blue-600',
  'bg-green-600',
  'bg-purple-600',
  'bg-orange-600',
  'bg-teal-600',
  'bg-indigo-600',
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
            Testimonials
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Trusted by Saccos Across East Africa
          </h2>
          <p className="text-xl text-gray-600">
            See what our customers have to say about their experience
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.name}
              className="relative bg-gray-50 rounded-xl p-6 border border-gray-100"
            >
              <Quote className="absolute top-4 right-4 w-8 h-8 text-blue-100" />

              <div className="flex items-center gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < testimonial.rating
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>

              <p className="text-gray-600 mb-6 leading-relaxed">
                "{testimonial.quote}"
              </p>

              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full ${bgColors[index % bgColors.length]} text-white flex items-center justify-center text-sm font-semibold`}
                >
                  {getInitials(testimonial.name)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">
                    {testimonial.name}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {testimonial.role}, {testimonial.organization}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
