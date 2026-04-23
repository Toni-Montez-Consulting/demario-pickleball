"use client";

import { useState } from "react";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import TrustBar from "@/components/TrustBar";
import Testimonials from "@/components/Testimonials";
import ImproveGrid from "@/components/ImproveGrid";
import Philosophy from "@/components/Philosophy";
import Lessons from "@/components/Lessons";
import About from "@/components/About";
import FinalCta from "@/components/FinalCta";
import BookingPlatforms from "@/components/BookingPlatforms";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";
import StickyCta from "@/components/StickyCta";
import BookingModal from "@/components/BookingModal";

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="device" id="device">
      <Nav onOpenBooking={() => setModalOpen(true)} />
      <Hero onOpenBooking={() => setModalOpen(true)} />
      <TrustBar />
      <Testimonials />
      <ImproveGrid />
      <Philosophy />
      <Lessons />
      <About />
      <FinalCta onOpenBooking={() => setModalOpen(true)} />
      <BookingPlatforms />
      <ContactForm />
      <Footer />
      <StickyCta onOpenBooking={() => setModalOpen(true)} />
      <BookingModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
