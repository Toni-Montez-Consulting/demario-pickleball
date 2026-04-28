"use client";

import { useState } from "react";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import TrustBar from "@/components/TrustBar";
import Testimonials from "@/components/Testimonials";
import ImproveGrid from "@/components/ImproveGrid";
import Philosophy from "@/components/Philosophy";
import Lessons from "@/components/Lessons";
import WhereWeTrain from "@/components/WhereWeTrain";
import About from "@/components/About";
import FinalCta from "@/components/FinalCta";
import BookingPlatforms from "@/components/BookingPlatforms";
import ContactForm from "@/components/ContactForm";
import CookieBanner from "@/components/CookieBanner";
import Footer from "@/components/Footer";
import StickyCta from "@/components/StickyCta";
import BookingModal from "@/components/BookingModal";
import type { LessonKey } from "@/lib/data";

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialLessonType, setInitialLessonType] = useState<LessonKey>("beginner");

  function openBooking(lessonType: LessonKey = "beginner") {
    setInitialLessonType(lessonType);
    setModalOpen(true);
  }

  return (
    <div className="device" id="device">
      <Nav onOpenBooking={() => openBooking()} />
      <Hero onOpenBooking={() => openBooking()} />
      <TrustBar />
      <Testimonials onOpenBooking={() => openBooking()} />
      <ImproveGrid />
      <Philosophy />
      <Lessons onOpenBooking={openBooking} />
      <WhereWeTrain />
      <About />
      <FinalCta onOpenBooking={() => openBooking()} />
      <BookingPlatforms />
      <ContactForm />
      <Footer />
      <StickyCta onOpenBooking={() => openBooking()} />
      <BookingModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialLessonType={initialLessonType}
      />
      <CookieBanner />
    </div>
  );
}
