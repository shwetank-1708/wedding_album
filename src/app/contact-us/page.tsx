import { MapPin, Phone, Mail, Clock } from "lucide-react";

export default function ContactUs() {
    return (
        <div className="min-h-screen bg-slate-50 py-24 px-4">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16 space-y-4">
                    <h1 className="text-4xl md:text-5xl font-serif text-slate-800">Get in Touch</h1>
                    <p className="text-slate-500 text-lg max-w-2xl mx-auto font-light">
                        We'd love to hear about your story. Send us a message and let's start planning something beautiful.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Contact Information */}
                    <div className="space-y-8">
                        <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100">
                            <h2 className="text-2xl font-serif text-slate-800 mb-6 border-b border-slate-100 pb-4">Contact Information</h2>
                            <div className="space-y-8">
                                <div className="flex items-start group">
                                    <div className="p-3 bg-sky-50 rounded-lg group-hover:bg-sky-100 transition-colors">
                                        <MapPin className="w-6 h-6 text-sky-600" />
                                    </div>
                                    <div className="ml-4">
                                        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide mb-1">Studio Address</h3>
                                        <p className="text-slate-500 leading-relaxed">123 Kingsway Road, Dehradun,<br />Uttarakhand, India - 248001</p>
                                    </div>
                                </div>

                                <div className="flex items-start group">
                                    <div className="p-3 bg-sky-50 rounded-lg group-hover:bg-sky-100 transition-colors">
                                        <Phone className="w-6 h-6 text-sky-600" />
                                    </div>
                                    <div className="ml-4">
                                        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide mb-1">Phone</h3>
                                        <p className="text-slate-500">+91 987 654 3210</p>
                                        <p className="text-slate-500">+91 123 456 7890</p>
                                    </div>
                                </div>

                                <div className="flex items-start group">
                                    <div className="p-3 bg-sky-50 rounded-lg group-hover:bg-sky-100 transition-colors">
                                        <Mail className="w-6 h-6 text-sky-600" />
                                    </div>
                                    <div className="ml-4">
                                        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide mb-1">Email</h3>
                                        <p className="text-slate-500">hello@weddingalbum.com</p>
                                        <p className="text-slate-500">bookings@weddingalbum.com</p>
                                    </div>
                                </div>

                                <div className="flex items-start group">
                                    <div className="p-3 bg-sky-50 rounded-lg group-hover:bg-sky-100 transition-colors">
                                        <Clock className="w-6 h-6 text-sky-600" />
                                    </div>
                                    <div className="ml-4">
                                        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide mb-1">Business Hours</h3>
                                        <p className="text-slate-500">Mon - Sat: 10:00 AM - 7:00 PM</p>
                                        <p className="text-slate-500">Sun: By Appointment Only</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contact Form */}
                    <div className="bg-white p-8 md:p-12 rounded-2xl shadow-xl border border-slate-100">
                        <h2 className="text-3xl font-serif text-slate-800 mb-2">Send Us a Message</h2>
                        <p className="text-slate-400 mb-8 text-sm">Fill out the form below and we will get back to you within 24 hours.</p>

                        <form className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="firstName" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">First Name</label>
                                    <input type="text" id="firstName" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all" placeholder="John" />
                                </div>
                                <div>
                                    <label htmlFor="lastName" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Last Name</label>
                                    <input type="text" id="lastName" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all" placeholder="Doe" />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Email Address</label>
                                <input type="email" id="email" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all" placeholder="john@example.com" />
                            </div>

                            <div>
                                <label htmlFor="subject" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Subject</label>
                                <select id="subject" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all text-slate-600">
                                    <option value="">Select an inquiry type</option>
                                    <option value="wedding">Wedding Photography</option>
                                    <option value="portrait">Portrait Session</option>
                                    <option value="event">Event Coverage</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>

                            <div>
                                <label htmlFor="message" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Message</label>
                                <textarea id="message" rows={5} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all" placeholder="Tell us more about your event..."></textarea>
                            </div>

                            <button type="submit" className="w-full py-4 bg-slate-900 text-white font-bold uppercase tracking-widest hover:bg-sky-600 transition-colors duration-300 rounded-lg shadow-lg">
                                Send Message
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
