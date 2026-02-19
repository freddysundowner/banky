import { useState, useEffect, useCallback } from 'react';
import { Star, Quote, ChevronLeft, ChevronRight } from 'lucide-react';

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
            Trusted by Saccos Across East Africa
          </h2>
          <p className="text-xl text-gray-600">
            See what our customers have to say about their experience
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
