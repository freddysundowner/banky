import { useState, useEffect, useCallback } from 'react';
import { Star, Quote, ChevronLeft, ChevronRight } from 'lucide-react';

const testimonials = [
  {
    name: 'James Mwangi',
    role: 'Chairman',
    organization: 'Ukulima Sacco',
    quote: 'We moved 5,000 members from paper ledgers to BANKY in a single weekend. Loan processing that took three days now takes three minutes. The M-Pesa integration alone saved our staff countless hours every month.',
    rating: 5,
  },
  {
    name: 'Grace Achieng',
    role: 'General Manager',
    organization: 'Boresha Sacco',
    quote: 'Our accountant used to spend the first two weeks of every month reconciling spreadsheets. With BANKY\'s automatic journal entries and trial balance, she now closes the books in a single day.',
    rating: 5,
  },
  {
    name: 'Peter Kamau',
    role: 'IT Manager',
    organization: 'Wekeza Investment Sacco',
    quote: 'Data security was our biggest concern. Knowing that our member data sits in a completely isolated database -- not shared with anyone -- gave our board the confidence to go digital.',
    rating: 5,
  },
  {
    name: 'Amina Hassan',
    role: 'Treasurer',
    organization: 'Maisha Chama Group',
    quote: 'Our chama had 30 members and a WhatsApp group for records. BANKY gave us a proper system with loan tracking, savings accounts, and dividend calculations. We feel like a real institution now.',
    rating: 5,
  },
  {
    name: 'David Ochieng',
    role: 'CEO',
    organization: 'Pamoja Microfinance',
    quote: 'We evaluated six different systems before choosing BANKY. The dividend calculation, fixed deposit module, and teller station put it miles ahead. It handles everything under one roof -- no add-ons needed.',
    rating: 5,
  },
  {
    name: 'Sarah Wambui',
    role: 'Finance Manager',
    organization: 'Umoja Community Sacco',
    quote: 'Our board now has real-time visibility into portfolio performance. Generating regulator reports used to take a week of manual work. Now it\'s literally one click.',
    rating: 5,
  },
  {
    name: 'Faith Njeri',
    role: 'Operations Director',
    organization: 'Fanaka Savings Sacco',
    quote: 'The teller station transformed our branch operations. Each teller has their own float, every transaction is accountable, and end-of-day reconciliation went from 2 hours to 10 minutes.',
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
  'bg-rose-600',
];

export default function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const visibleCount = 3;
  const maxIndex = testimonials.length - visibleCount;

  const next = useCallback(() => {
    setCurrentIndex(prev => (prev >= maxIndex ? 0 : prev + 1));
  }, [maxIndex]);

  const prev = useCallback(() => {
    setCurrentIndex(prev => (prev <= 0 ? maxIndex : prev - 1));
  }, [maxIndex]);

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  return (
    <section id="testimonials" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
            Testimonials
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Loved by Banks, Saccos & Chamas Across East Africa
          </h2>
          <p className="text-xl text-gray-600">
            Hear from organizations that replaced spreadsheets and legacy systems with BANKY
          </p>
        </div>

        <div className="relative">
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${currentIndex * (100 / visibleCount)}%)` }}
            >
              {testimonials.map((testimonial, index) => (
                <div
                  key={testimonial.name}
                  className="flex-shrink-0 px-3"
                  style={{ width: `${100 / visibleCount}%` }}
                >
                  <div className="relative bg-gray-50 rounded-xl p-6 border border-gray-100 h-full">
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
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={prev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-10 h-10 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center text-gray-600 hover:text-gray-900 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-10 h-10 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center text-gray-600 hover:text-gray-900 transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex justify-center gap-2 mt-8">
          {Array.from({ length: maxIndex + 1 }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-2.5 h-2.5 rounded-full transition ${
                i === currentIndex ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
