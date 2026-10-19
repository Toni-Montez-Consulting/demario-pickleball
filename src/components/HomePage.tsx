"use client";

import { useState } from "react";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import TrustBar from "@/components/TrustBar";
import Testimonials from "@/components/Testimonials";
import ImproveGrid from "@/components/ImproveGrid";
import FilmRoom from "@/components/FilmRoom";
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
import { trackEvent, type CtaSource } from "@/lib/analytics";

export default function HomePage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [initialLessonType, setInitialLessonType] = useState<LessonKey>("beginner");

  // Every Book button routes through here, so the source is recorded once
  // instead of in each component.
  function openBooking(source: CtaSource, lessonType?: LessonKey) {
    trackEvent("book_cta_click", { source, lesson_type: lessonType });
    setInitialLessonType(lessonType ?? "beginner");
    setModalOpen(true);
  }

  return (
    <div className="device" id="device">
      <Nav onOpenBooking={() => openBooking("nav")} />
      {/* One main landmark, so screen-reader users can jump past the nav. */}
      <main>
      <Hero onOpenBooking={() => openBooking("hero")} />
      <TrustBar />
      <Testimonials onOpenBooking={() => openBooking("testimonials")} />
      <ImproveGrid />
      <FilmRoom />
      <Philosophy />
      <Lessons onOpenBooking={(lessonType) => openBooking("lessons", lessonType)} />
      <WhereWeTrain />
      <About />
      <FinalCta onOpenBooking={() => openBooking("final_cta")} />
      <BookingPlatforms />
      <ContactForm />
      </main>
      <Footer />
      <StickyCta onOpenBooking={() => openBooking("sticky")} />
      <BookingModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialLessonType={initialLessonType}
      />
      <CookieBanner />
    </div>
  );
}
