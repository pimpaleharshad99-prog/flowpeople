import React, { useState, useEffect } from 'react';
import { Logo } from '../components/brand/Logo';

interface LandingPageViewProps {
  onNavigateLogin: () => void;
  onNavigateRegister: (selectedPlanId?: string) => void;
  onNavigateKiosk: () => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onNavigateLogin,
  onNavigateRegister,
  onNavigateKiosk
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'attendance' | 'leave' | 'payroll'>('attendance');
  const [isYearly, setIsYearly] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="flowpeople-landing">
      {/* Embedded High-Fidelity Styles from flowpeople.html */}
      <style>{`
        .flowpeople-landing {
          --teal-50: #effcfa;
          --teal-100: #d5f5f0;
          --teal-200: #aeeae0;
          --teal-400: #2dc4b2;
          --teal-500: #14a89a;
          --teal-600: #0d8a7f;
          --teal-700: #0f6e67;
          --teal-900: #0b3b3a;
          --ink: #0f1f24;
          --ink-2: #41565c;
          --ink-3: #6d8187;
          --line: #e4ecee;
          --bg: #fff;
          --bg-soft: #f6fafa;
          --shadow-sm: 0 1px 2px rgba(15,31,36,.05), 0 2px 8px rgba(15,31,36,.05);
          --shadow-md: 0 8px 24px rgba(15,31,36,.08);
          --shadow-lg: 0 24px 60px rgba(13,138,127,.16), 0 8px 24px rgba(15,31,36,.08);
          --r: 20px;
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;
          color: var(--ink);
          background: var(--bg);
          line-height: 1.6;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
          min-height: 100vh;
        }

        .flowpeople-landing * {
          box-sizing: border-box;
        }

        .flowpeople-landing h1, 
        .flowpeople-landing h2, 
        .flowpeople-landing h3, 
        .flowpeople-landing h4 {
          font-family: "Plus Jakarta Sans", Inter, -apple-system, sans-serif;
          line-height: 1.15;
          letter-spacing: -0.02em;
          color: var(--ink);
        }

        .flowpeople-landing a {
          color: inherit;
          text-decoration: none;
        }

        .flowpeople-landing .wrap {
          width: min(1200px, 100% - 40px);
          margin-inline: auto;
        }

        .flowpeople-landing section {
          padding: 96px 0;
        }

        .flowpeople-landing .eyebrow {
          display: inline-block;
          font: 600 13px/1 "Plus Jakarta Sans", sans-serif;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: var(--teal-600);
          background: var(--teal-50);
          border: 1px solid var(--teal-100);
          padding: 8px 14px;
          border-radius: 99px;
          margin-bottom: 18px;
        }

        .flowpeople-landing .sec-head {
          max-width: 680px;
          margin: 0 auto 56px;
          text-align: center;
        }

        .flowpeople-landing .sec-head h2 {
          font-size: clamp(28px, 4vw, 42px);
          margin-bottom: 14px;
        }

        .flowpeople-landing .sec-head p {
          color: var(--ink-2);
          font-size: 18px;
        }

        .flowpeople-landing .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font: 600 15px/1 "Plus Jakarta Sans", sans-serif;
          padding: 15px 24px;
          border-radius: 12px;
          border: 1px solid transparent;
          cursor: pointer;
          transition: transform .2s, box-shadow .2s, background .2s;
        }

        .flowpeople-landing .btn:focus-visible,
        .flowpeople-landing a:focus-visible,
        .flowpeople-landing summary:focus-visible,
        .flowpeople-landing button:focus-visible {
          outline: 3px solid var(--teal-400);
          outline-offset: 3px;
        }

        .flowpeople-landing .btn-primary {
          background: var(--teal-600);
          color: #fff;
          box-shadow: 0 6px 18px rgba(13,138,127,.3);
        }

        .flowpeople-landing .btn-primary:hover {
          background: var(--teal-700);
          transform: translateY(-2px);
        }

        .flowpeople-landing .btn-ghost {
          background: #fff;
          color: var(--ink);
          border-color: var(--line);
          box-shadow: var(--shadow-sm);
        }

        .flowpeople-landing .btn-ghost:hover {
          border-color: var(--teal-400);
          transform: translateY(-2px);
        }

        .flowpeople-landing .btn-sm {
          padding: 11px 18px;
          font-size: 14px;
        }

        /* HEADER & NAVIGATION */
        .flowpeople-landing header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(255,255,255,.92);
          backdrop-filter: blur(14px);
          border-bottom: 1px solid transparent;
          transition: border-color .2s, box-shadow .2s;
        }

        .flowpeople-landing header.scrolled {
          border-color: var(--line);
          box-shadow: var(--shadow-sm);
        }

        .flowpeople-landing .nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 72px;
        }

        .flowpeople-landing .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font: 800 21px "Plus Jakarta Sans", sans-serif;
          letter-spacing: -.03em;
          color: var(--ink);
          cursor: pointer;
        }

        .flowpeople-landing .logo small {
          font-weight: 600;
          color: var(--teal-600);
        }

        .flowpeople-landing .logo-mark {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          flex-shrink: 0;
        }

        .flowpeople-landing .nav-links {
          display: flex;
          gap: 30px;
          font-weight: 500;
          font-size: 15px;
          color: var(--ink-2);
        }

        .flowpeople-landing .nav-links a:hover {
          color: var(--teal-600);
        }

        .flowpeople-landing .nav-cta {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .flowpeople-landing .nav-cta .login {
          font-weight: 600;
          font-size: 15px;
          color: var(--ink-2);
          padding: 10px 14px;
          border-radius: 10px;
          transition: color .2s, background .2s;
          cursor: pointer;
        }

        .flowpeople-landing .nav-cta .login:hover {
          color: var(--teal-600);
          background: var(--teal-50);
        }

        .flowpeople-landing .burger {
          display: none;
          background: none;
          border: 1px solid var(--line);
          border-radius: 10px;
          width: 44px;
          height: 44px;
          cursor: pointer;
          align-items: center;
          justify-content: center;
          color: var(--ink);
        }

        .flowpeople-landing .mobile-menu {
          display: none;
          border-top: 1px solid var(--line);
          padding: 12px 20px 20px;
          background: #fff;
        }

        .flowpeople-landing .mobile-menu a {
          display: block;
          padding: 14px 4px;
          font-weight: 600;
          border-bottom: 1px solid var(--line);
          color: var(--ink);
        }

        .flowpeople-landing .mobile-menu .btn {
          margin-top: 16px;
          width: 100%;
          border: 0;
        }

        .flowpeople-landing .mobile-menu.open {
          display: block;
        }

        /* HERO */
        .flowpeople-landing .hero {
          padding: 72px 0 88px;
          background: radial-gradient(900px 500px at 85% -10%, var(--teal-100), transparent 60%),
                      radial-gradient(600px 400px at 0% 20%, var(--teal-50), transparent 60%);
        }

        .flowpeople-landing .hero-grid {
          display: grid;
          grid-template-columns: 1fr 1.15fr;
          gap: 56px;
          align-items: center;
        }

        .flowpeople-landing .hero h1 {
          font-size: clamp(40px, 6vw, 66px);
          margin-bottom: 20px;
        }

        .flowpeople-landing .hero h1 span {
          background: linear-gradient(90deg, var(--teal-600), var(--teal-400));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .flowpeople-landing .hero p.lead {
          font-size: 19px;
          color: var(--ink-2);
          max-width: 520px;
          margin-bottom: 32px;
        }

        .flowpeople-landing .hero-ctas {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 30px;
        }

        .flowpeople-landing .trust {
          display: flex;
          gap: 22px;
          flex-wrap: wrap;
          font-size: 14px;
          color: var(--ink-3);
        }

        .flowpeople-landing .trust span {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .flowpeople-landing .trust svg {
          width: 16px;
          height: 16px;
          color: var(--teal-500);
        }

        .flowpeople-landing .hero-visual {
          position: relative;
        }

        .flowpeople-landing .float {
          position: absolute;
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 16px;
          box-shadow: var(--shadow-md);
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
          z-index: 2;
          animation: floatBob 6s ease-in-out infinite;
        }

        .flowpeople-landing .float b {
          display: block;
          font: 700 14px "Plus Jakarta Sans", sans-serif;
        }

        .flowpeople-landing .float .ic {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: var(--teal-50);
          color: var(--teal-600);
          display: grid;
          place-items: center;
        }

        .flowpeople-landing .float .ic svg {
          width: 20px;
          height: 20px;
        }

        .flowpeople-landing .f1 {
          top: -18px;
          left: -22px;
        }

        .flowpeople-landing .f2 {
          bottom: -26px;
          right: -12px;
          animation-delay: -3s;
        }

        @keyframes floatBob {
          50% { transform: translateY(-9px); }
        }

        /* DASHBOARD MOCKUP */
        .flowpeople-landing .dash {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 22px;
          box-shadow: var(--shadow-lg);
          overflow: hidden;
        }

        .flowpeople-landing .dash-bar {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--line);
          background: var(--bg-soft);
        }

        .flowpeople-landing .dash-bar i {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #d6e2e4;
        }

        .flowpeople-landing .dash-bar em {
          margin-left: 10px;
          font-style: normal;
          font-size: 12px;
          color: var(--ink-3);
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 3px 12px;
        }

        .flowpeople-landing .dash-body {
          display: grid;
          grid-template-columns: 150px 1fr;
          min-height: 340px;
        }

        .flowpeople-landing .side {
          border-right: 1px solid var(--line);
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 13px;
          color: var(--ink-2);
        }

        .flowpeople-landing .side div {
          padding: 9px 12px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .flowpeople-landing .side div.on {
          background: var(--teal-50);
          color: var(--teal-700);
          font-weight: 600;
        }

        .flowpeople-landing .side svg {
          width: 16px;
          height: 16px;
          flex: none;
        }

        .flowpeople-landing .main {
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-width: 0;
        }

        .flowpeople-landing .kpis {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .flowpeople-landing .kpi {
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 12px;
        }

        .flowpeople-landing .kpi small {
          font-size: 11px;
          color: var(--ink-3);
        }

        .flowpeople-landing .kpi strong {
          display: block;
          font: 800 22px "Plus Jakarta Sans", sans-serif;
          margin-top: 2px;
        }

        .flowpeople-landing .kpi em {
          font-style: normal;
          font-size: 11px;
          color: var(--teal-600);
          font-weight: 600;
        }

        .flowpeople-landing .panels {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 10px;
        }

        .flowpeople-landing .panel {
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 14px;
          min-width: 0;
        }

        .flowpeople-landing .panel h5 {
          font: 700 12px "Plus Jakarta Sans", sans-serif;
          margin-bottom: 10px;
          color: var(--ink-2);
        }

        .flowpeople-landing .bars {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          height: 92px;
        }

        .flowpeople-landing .bars span {
          flex: 1;
          background: linear-gradient(var(--teal-400), var(--teal-500));
          border-radius: 6px 6px 2px 2px;
          transform-origin: bottom;
          animation: barGrow 1.2s cubic-bezier(.2,.8,.2,1) both;
        }

        .flowpeople-landing .bars span:nth-child(odd) {
          opacity: .55;
        }

        @keyframes barGrow {
          from { transform: scaleY(0); }
        }

        .flowpeople-landing .rows {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 12px;
        }

        .flowpeople-landing .rows div {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .flowpeople-landing .av {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--teal-100);
          color: var(--teal-700);
          font: 700 10px/22px "Plus Jakarta Sans", sans-serif;
          text-align: center;
          flex: none;
        }

        .flowpeople-landing .pill {
          margin-left: auto;
          white-space: nowrap;
          font-size: 10px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 99px;
          background: var(--teal-50);
          color: var(--teal-700);
        }

        .flowpeople-landing .pill.late {
          background: #fff4e5;
          color: #b45f06;
        }

        /* STATS */
        .flowpeople-landing .stats {
          padding: 0 0 40px;
        }

        .flowpeople-landing .stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          border: 1px solid var(--line);
          border-radius: var(--r);
          padding: 28px;
          box-shadow: var(--shadow-sm);
          background: #fff;
          margin-top: -30px;
          position: relative;
        }

        .flowpeople-landing .stat {
          text-align: center;
        }

        .flowpeople-landing .stat strong {
          display: block;
          font: 800 34px "Plus Jakarta Sans", sans-serif;
          color: var(--teal-600);
        }

        .flowpeople-landing .stat span {
          font-size: 14px;
          color: var(--ink-3);
        }

        /* FEATURES */
        .flowpeople-landing .grid-4 {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }

        .flowpeople-landing .card {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: var(--r);
          padding: 28px;
          box-shadow: var(--shadow-sm);
          transition: transform .25s, box-shadow .25s, border-color .25s;
        }

        .flowpeople-landing .card:hover {
          transform: translateY(-5px);
          box-shadow: var(--shadow-md);
          border-color: var(--teal-200);
        }

        .flowpeople-landing .card .ic {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: var(--teal-50);
          color: var(--teal-600);
          display: grid;
          place-items: center;
          margin-bottom: 18px;
        }

        .flowpeople-landing .card .ic svg {
          width: 24px;
          height: 24px;
        }

        .flowpeople-landing .card h3 {
          font-size: 18px;
          margin-bottom: 8px;
        }

        .flowpeople-landing .card p {
          font-size: 15px;
          color: var(--ink-2);
        }

        .flowpeople-landing .card.hi {
          background: linear-gradient(160deg, var(--teal-600), var(--teal-700));
          color: #fff;
          border: 0;
        }

        .flowpeople-landing .card.hi h3 {
          color: #fff;
        }

        .flowpeople-landing .card.hi p {
          color: #d3f3ee;
        }

        .flowpeople-landing .card.hi .ic {
          background: rgba(255,255,255,.16);
          color: #fff;
        }

        /* HOW IT WORKS */
        .flowpeople-landing .how {
          background: var(--bg-soft);
        }

        .flowpeople-landing .steps {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
          position: relative;
        }

        .flowpeople-landing .steps:before {
          content: "";
          position: absolute;
          top: 27px;
          left: 12%;
          right: 12%;
          height: 2px;
          background: repeating-linear-gradient(90deg, var(--teal-200) 0 8px, transparent 8px 16px);
        }

        .flowpeople-landing .step {
          text-align: center;
          position: relative;
        }

        .flowpeople-landing .num {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid var(--teal-400);
          color: var(--teal-600);
          font: 800 20px/52px "Plus Jakarta Sans", sans-serif;
          margin: 0 auto 18px;
          box-shadow: 0 0 0 8px var(--bg-soft);
        }

        .flowpeople-landing .step h3 {
          font-size: 18px;
          margin-bottom: 8px;
        }

        .flowpeople-landing .step p {
          font-size: 15px;
          color: var(--ink-2);
        }

        /* FACE SHOWCASE */
        .flowpeople-landing .split {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 64px;
          align-items: center;
        }

        .flowpeople-landing .split h2 {
          font-size: clamp(28px, 4vw, 42px);
          margin-bottom: 16px;
        }

        .flowpeople-landing .split p.lead {
          color: var(--ink-2);
          font-size: 18px;
          margin-bottom: 24px;
        }

        .flowpeople-landing .checks {
          list-style: none;
          display: grid;
          gap: 14px;
          margin-bottom: 32px;
          padding: 0;
        }

        .flowpeople-landing .checks li {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          color: var(--ink-2);
        }

        .flowpeople-landing .checks svg {
          width: 22px;
          height: 22px;
          flex: none;
          color: var(--teal-600);
          margin-top: 2px;
        }

        .flowpeople-landing .checks b {
          color: var(--ink);
        }

        .flowpeople-landing .kiosk {
          background: linear-gradient(160deg, #0e2b2e, #0b3b3a);
          border-radius: 28px;
          padding: 28px;
          box-shadow: var(--shadow-lg);
          color: #fff;
          position: relative;
          overflow: hidden;
        }

        .flowpeople-landing .kiosk:before {
          content: "";
          position: absolute;
          inset: -40% -20% auto auto;
          width: 360px;
          height: 360px;
          background: radial-gradient(circle, rgba(45,196,178,.35), transparent 65%);
        }

        .flowpeople-landing .kiosk-top {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: #a9cfcb;
          position: relative;
        }

        .flowpeople-landing .kiosk-top b {
          color: #fff;
        }

        .flowpeople-landing .scan {
          position: relative;
          width: min(260px, 70%);
          aspect-ratio: 3/4;
          margin: 22px auto;
          border-radius: 22px;
          background: linear-gradient(180deg, #14484a, #0e3436);
          border: 1px solid rgba(255,255,255,.12);
          overflow: hidden;
        }

        .flowpeople-landing .scan svg.face {
          position: absolute;
          inset: 0;
          margin: auto;
          width: 78%;
          color: #7fe0d3;
          opacity: .9;
        }

        .flowpeople-landing .scan .corner {
          position: absolute;
          width: 34px;
          height: 34px;
          border: 3px solid var(--teal-400);
        }

        .flowpeople-landing .c1 {
          top: 14px;
          left: 14px;
          border-right: 0;
          border-bottom: 0;
          border-radius: 10px 0 0 0;
        }

        .flowpeople-landing .c2 {
          top: 14px;
          right: 14px;
          border-left: 0;
          border-bottom: 0;
          border-radius: 0 10px 0 0;
        }

        .flowpeople-landing .c3 {
          bottom: 14px;
          left: 14px;
          border-right: 0;
          border-top: 0;
          border-radius: 0 0 0 10px;
        }

        .flowpeople-landing .c4 {
          bottom: 14px;
          right: 14px;
          border-left: 0;
          border-top: 0;
          border-radius: 0 0 10px 0;
        }

        .flowpeople-landing .scan .line {
          position: absolute;
          left: 8%;
          right: 8%;
          height: 3px;
          border-radius: 3px;
          background: linear-gradient(90deg, transparent, var(--teal-400), transparent);
          box-shadow: 0 0 18px var(--teal-400);
          animation: scanLaser 2.8s ease-in-out infinite;
        }

        @keyframes scanLaser {
          0%, 100% { top: 12%; }
          50% { top: 86%; }
        }

        .flowpeople-landing .result {
          position: relative;
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.14);
          border-radius: 16px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .flowpeople-landing .result .av {
          width: 40px;
          height: 40px;
          line-height: 40px;
          font-size: 14px;
          background: var(--teal-400);
          color: #06302d;
        }

        .flowpeople-landing .result b {
          display: block;
          color: #fff;
        }

        .flowpeople-landing .result small {
          color: #a9cfcb;
        }

        .flowpeople-landing .result .ok {
          margin-left: auto;
          background: var(--teal-400);
          color: #06302d;
          font: 700 12px "Plus Jakarta Sans", sans-serif;
          padding: 6px 12px;
          border-radius: 99px;
          white-space: nowrap;
        }

        /* DASH PREVIEW TABS */
        .flowpeople-landing .preview {
          background: linear-gradient(180deg, #fff, var(--teal-50));
        }

        .flowpeople-landing .tabs {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-bottom: 28px;
          flex-wrap: wrap;
        }

        .flowpeople-landing .tab {
          font: 600 14px "Plus Jakarta Sans", sans-serif;
          padding: 11px 20px;
          border-radius: 99px;
          border: 1px solid var(--line);
          background: #fff;
          color: var(--ink-2);
          cursor: pointer;
          transition: all .2s;
        }

        .flowpeople-landing .tab.active {
          background: var(--teal-600);
          color: #fff;
          border-color: var(--teal-600);
        }

        .flowpeople-landing .big-dash {
          max-width: 960px;
          margin: 0 auto;
        }

        .flowpeople-landing .tbl {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .flowpeople-landing .tbl th {
          text-align: left;
          color: var(--ink-3);
          font-weight: 600;
          padding: 8px 6px;
          border-bottom: 1px solid var(--line);
        }

        .flowpeople-landing .tbl td {
          padding: 10px 6px;
          border-bottom: 1px solid var(--line);
        }

        .flowpeople-landing .tbl-wrap {
          overflow-x: auto;
        }

        .flowpeople-landing .progress {
          height: 8px;
          background: var(--teal-50);
          border-radius: 9px;
          overflow: hidden;
          min-width: 70px;
        }

        .flowpeople-landing .progress i {
          display: block;
          height: 100%;
          background: var(--teal-500);
          border-radius: 9px;
        }

        /* SECURITY */
        .flowpeople-landing .sec-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }

        .flowpeople-landing .sec-banner {
          margin-top: 28px;
          background: var(--teal-900);
          color: #fff;
          border-radius: var(--r);
          padding: 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
        }

        .flowpeople-landing .sec-banner p {
          color: #b6dad6;
          max-width: 640px;
        }

        .flowpeople-landing .sec-banner h3 {
          font-size: 22px;
          margin-bottom: 6px;
          color: #fff;
        }

        /* PRICING */
        .flowpeople-landing .pricing {
          background: var(--bg-soft);
        }

        .flowpeople-landing .toggle {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 14px;
          margin-bottom: 40px;
          font-weight: 600;
          font-size: 15px;
          color: var(--ink-2);
        }

        .flowpeople-landing .switch {
          width: 52px;
          height: 30px;
          border-radius: 99px;
          background: var(--teal-600);
          border: 0;
          position: relative;
          cursor: pointer;
        }

        .flowpeople-landing .switch:after {
          content: "";
          position: absolute;
          top: 3px;
          left: 3px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #fff;
          transition: transform .2s;
        }

        .flowpeople-landing .switch.checked:after {
          transform: translateX(22px);
        }

        .flowpeople-landing .save {
          background: var(--teal-100);
          color: var(--teal-700);
          font-size: 12px;
          padding: 4px 10px;
          border-radius: 99px;
        }

        .flowpeople-landing .plans {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 22px;
          align-items: stretch;
        }

        .flowpeople-landing .plan {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 24px;
          padding: 34px 30px;
          box-shadow: var(--shadow-sm);
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .flowpeople-landing .plan.pop {
          border: 2px solid var(--teal-500);
          box-shadow: var(--shadow-lg);
          transform: translateY(-10px);
        }

        .flowpeople-landing .badge {
          position: absolute;
          top: -14px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--teal-600);
          color: #fff;
          font: 700 12px "Plus Jakarta Sans", sans-serif;
          padding: 6px 14px;
          border-radius: 99px;
        }

        .flowpeople-landing .plan h3 {
          font-size: 20px;
        }

        .flowpeople-landing .plan .sub {
          color: var(--ink-3);
          font-size: 14px;
          margin: 6px 0 20px;
          min-height: 44px;
        }

        .flowpeople-landing .price {
          font: 800 44px "Plus Jakarta Sans", sans-serif;
          letter-spacing: -.03em;
        }

        .flowpeople-landing .price small {
          font: 500 14px Inter, sans-serif;
          color: var(--ink-3);
          letter-spacing: 0;
        }

        .flowpeople-landing .plan ul {
          list-style: none;
          margin: 24px 0 30px;
          display: grid;
          gap: 12px;
          font-size: 15px;
          color: var(--ink-2);
          flex: 1;
          padding: 0;
        }

        .flowpeople-landing .plan li {
          display: flex;
          gap: 10px;
        }

        .flowpeople-landing .plan li svg {
          width: 18px;
          height: 18px;
          flex: none;
          color: var(--teal-600);
          margin-top: 3px;
        }

        .flowpeople-landing .plan .btn {
          width: 100%;
        }

        .flowpeople-landing .note {
          text-align: center;
          margin-top: 28px;
          color: var(--ink-3);
          font-size: 14px;
        }

        /* FAQ */
        .flowpeople-landing .faq {
          max-width: 800px;
          margin: 0 auto;
          display: grid;
          gap: 12px;
        }

        .flowpeople-landing details {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 16px;
          box-shadow: var(--shadow-sm);
          transition: border-color .2s;
        }

        .flowpeople-landing details[open] {
          border-color: var(--teal-200);
        }

        .flowpeople-landing summary {
          list-style: none;
          cursor: pointer;
          padding: 20px 24px;
          font: 700 17px "Plus Jakarta Sans", sans-serif;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }

        .flowpeople-landing summary::-webkit-details-marker {
          display: none;
        }

        .flowpeople-landing summary:after {
          content: "+";
          font: 500 26px/1 Inter, sans-serif;
          color: var(--teal-600);
          transition: transform .2s;
        }

        .flowpeople-landing details[open] summary:after {
          transform: rotate(45deg);
        }

        .flowpeople-landing details p {
          padding: 0 24px 22px;
          color: var(--ink-2);
        }

        /* CTA & FOOTER */
        .flowpeople-landing .cta {
          padding: 0 0 96px;
        }

        .flowpeople-landing .cta-box {
          background: linear-gradient(135deg, var(--teal-600), var(--teal-700));
          border-radius: 32px;
          padding: 64px 32px;
          text-align: center;
          color: #fff;
          position: relative;
          overflow: hidden;
        }

        .flowpeople-landing .cta-box:before {
          content: "";
          position: absolute;
          right: -80px;
          top: -80px;
          width: 300px;
          height: 300px;
          border-radius: 50%;
          background: rgba(255,255,255,.08);
        }

        .flowpeople-landing .cta-box h2 {
          font-size: clamp(28px, 4vw, 42px);
          margin-bottom: 12px;
          position: relative;
          color: #fff;
        }

        .flowpeople-landing .cta-box p {
          color: #d3f3ee;
          margin-bottom: 28px;
          font-size: 18px;
          position: relative;
        }

        .flowpeople-landing .cta-box .btn-primary {
          background: #fff;
          color: var(--teal-700);
          box-shadow: none;
        }

        .flowpeople-landing .cta-box .btn-ghost {
          background: transparent;
          color: #fff;
          border-color: rgba(255,255,255,.5);
          box-shadow: none;
        }

        .flowpeople-landing .cta-box .row {
          display: flex;
          gap: 14px;
          justify-content: center;
          flex-wrap: wrap;
          position: relative;
        }

        .flowpeople-landing footer {
          background: var(--ink);
          color: #b4c5c9;
          padding: 72px 0 32px;
        }

        .flowpeople-landing .foot-grid {
          display: grid;
          grid-template-columns: 1.6fr repeat(3, 1fr);
          gap: 40px;
          margin-bottom: 48px;
        }

        .flowpeople-landing footer .logo {
          color: #fff;
          margin-bottom: 14px;
        }

        .flowpeople-landing footer p {
          font-size: 14px;
          max-width: 320px;
        }

        .flowpeople-landing footer h4 {
          color: #fff;
          font-size: 14px;
          margin-bottom: 16px;
        }

        .flowpeople-landing footer ul {
          list-style: none;
          display: grid;
          gap: 10px;
          font-size: 14px;
          padding: 0;
        }

        .flowpeople-landing footer a:hover {
          color: var(--teal-400);
        }

        .flowpeople-landing .foot-bottom {
          border-top: 1px solid #243a40;
          padding-top: 24px;
          display: flex;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          font-size: 13px;
        }

        .flowpeople-landing .by {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #fff;
          font-weight: 600;
        }

        /* RESPONSIVE */
        @media (max-width: 1060px) {
          .flowpeople-landing .grid-4 { grid-template-columns: repeat(2, 1fr); }
          .flowpeople-landing .hero-grid, 
          .flowpeople-landing .split { grid-template-columns: 1fr; gap: 48px; }
          .flowpeople-landing .hero p.lead { max-width: none; }
          .flowpeople-landing .steps { grid-template-columns: repeat(2, 1fr); row-gap: 36px; }
          .flowpeople-landing .steps:before { display: none; }
          .flowpeople-landing .foot-grid { grid-template-columns: 1fr 1fr; }
          .flowpeople-landing .split .kiosk-col { order: -1; }
        }

        @media (max-width: 860px) {
          .flowpeople-landing .nav-links, 
          .flowpeople-landing .nav-cta .login, 
          .flowpeople-landing .nav-cta .btn { display: none; }
          .flowpeople-landing .burger { display: flex; }
          .flowpeople-landing .sec-grid, 
          .flowpeople-landing .plans { grid-template-columns: 1fr; }
          .flowpeople-landing .plan.pop { transform: none; }
          .flowpeople-landing .stats-row { grid-template-columns: repeat(2, 1fr); }
          .flowpeople-landing section { padding: 72px 0; }
        }

        @media (max-width: 600px) {
          .flowpeople-landing .grid-4 { grid-template-columns: 1fr; }
          .flowpeople-landing .steps { grid-template-columns: 1fr; }
          .flowpeople-landing .dash-body { grid-template-columns: 1fr; }
          .flowpeople-landing .side { display: none; }
          .flowpeople-landing .kpis { grid-template-columns: 1fr 1fr; }
          .flowpeople-landing .kpis .kpi:last-child { display: none; }
          .flowpeople-landing .panels { grid-template-columns: 1fr; }
          .flowpeople-landing .float { display: none; }
          .flowpeople-landing .foot-grid { grid-template-columns: 1fr; }
          .flowpeople-landing .hero-ctas .btn { width: 100%; }
          .flowpeople-landing .sec-banner { padding: 24px; }
          .flowpeople-landing .result { flex-wrap: wrap; }
        }
      `}</style>

      {/* STICKY HEADER NAVIGATION */}
      <header className={isScrolled ? 'scrolled' : ''}>
        <div className="wrap nav">
          <div className="logo cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <Logo variant="full" size={36} colorMode="dark" />
          </div>

          <nav className="nav-links">
            <a href="#features">Features</a>
            <a href="#solutions">Solutions</a>
            <a href="#pricing">Pricing</a>
            <a href="#about">About</a>
          </nav>

          <div className="nav-cta">
            <button className="login" onClick={onNavigateLogin}>Login</button>
            <button className="btn btn-primary btn-sm" onClick={() => onNavigateRegister()}>Get Started</button>
            <button 
              className="burger" 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Open menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16"/>
              </svg>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="mobile-menu open">
            <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#solutions" onClick={() => setMobileMenuOpen(false)}>Solutions</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <a href="#about" onClick={() => setMobileMenuOpen(false)}>About</a>
            <a onClick={() => { setMobileMenuOpen(false); onNavigateLogin(); }}>Login</a>
            <button className="btn btn-primary" onClick={() => { setMobileMenuOpen(false); onNavigateRegister(); }}>
              Get Started
            </button>
          </div>
        )}
      </header>

      <main>
        {/* HERO */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <span className="eyebrow">HRMS with biometric attendance</span>
              <h1>People Management. <span>Simplified.</span></h1>
              <p className="lead">
                FlowPeople brings intelligent HR management and biometric attendance into one calm workspace. Track every shift with face and fingerprint check-ins, run payroll with confidence, and give your team the tools they need.
              </p>
              <div className="hero-ctas">
                <button className="btn btn-primary" onClick={() => onNavigateRegister()}>
                  Start Free Trial
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6"/>
                  </svg>
                </button>
                <a className="btn btn-ghost" href="#features">Explore Features</a>
              </div>
              <div className="trust">
                <span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5"/>
                  </svg>
                  14-day free trial
                </span>
                <span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5"/>
                  </svg>
                  No credit card needed
                </span>
                <span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5"/>
                  </svg>
                  Setup in a day
                </span>
              </div>
            </div>

            <div className="hero-visual">
              <div className="float f1">
                <div className="ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/>
                    <path d="M9 10v1M15 10v1M12 10v3.5h-1M9 16c1.7 1.4 4.3 1.4 6 0"/>
                  </svg>
                </div>
                <div><b>Face verified</b>Priya S. · 09:02 AM</div>
              </div>

              <div className="float f2">
                <div className="ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6"/>
                  </svg>
                </div>
                <div><b>96.4% on time</b>This week</div>
              </div>

              <div className="dash">
                <div className="dash-bar"><i></i><i></i><i></i><em>app.flowpeople.com/dashboard</em></div>
                <div className="dash-body">
                  <div className="side">
                    <div className="on">Overview</div>
                    <div>Employees</div>
                    <div>Attendance</div>
                    <div>Leave</div>
                    <div>Payroll</div>
                    <div>Reports</div>
                  </div>
                  <div className="main">
                    <div className="kpis">
                      <div className="kpi"><small>Total employees</small><strong>1,248</strong><em>+3.2%</em></div>
                      <div className="kpi"><small>Present today</small><strong>1,174</strong><em>94.1%</em></div>
                      <div className="kpi"><small>On leave</small><strong>38</strong><em>Approved</em></div>
                    </div>
                    <div className="panels">
                      <div className="panel">
                        <h5>Weekly attendance</h5>
                        <div className="bars">
                          <span style={{ height: '62%' }}></span>
                          <span style={{ height: '78%' }}></span>
                          <span style={{ height: '70%' }}></span>
                          <span style={{ height: '92%' }}></span>
                          <span style={{ height: '84%' }}></span>
                          <span style={{ height: '46%' }}></span>
                          <span style={{ height: '30%' }}></span>
                        </div>
                      </div>
                      <div className="panel">
                        <h5>Latest check-ins</h5>
                        <div className="rows">
                          <div><span className="av">PS</span>Priya S.<span className="pill">On time</span></div>
                          <div><span className="av">RK</span>Rahul K.<span className="pill">On time</span></div>
                          <div><span className="av">AM</span>Anita M.<span className="pill late">Late 8m</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STATS */}
        <div className="stats">
          <div className="wrap">
            <div className="stats-row">
              <div className="stat"><strong>99.9%</strong><span>Face match accuracy</span></div>
              <div className="stat"><strong>&lt;2s</strong><span>Average check-in time</span></div>
              <div className="stat"><strong>80%</strong><span>Less time on HR admin</span></div>
              <div className="stat"><strong>1 day</strong><span>Typical go-live</span></div>
            </div>
          </div>
        </div>

        {/* FEATURES */}
        <section id="features">
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">Features</span>
              <h2>Everything your people team needs</h2>
              <p>Eight connected modules that replace spreadsheets, paper registers and scattered tools.</p>
            </div>
            <div className="grid-4">
              <article className="card hi">
                <div className="ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/>
                    <path d="M9 10v1M15 10v1M12 10v3.5h-1M9 16c1.7 1.4 4.3 1.4 6 0"/>
                  </svg>
                </div>
                <h3>Face Recognition Attendance</h3>
                <p>Contactless check-in in under two seconds, with live liveness checks to stop photo and video spoofing.</p>
              </article>

              <article className="card">
                <div className="ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 11v4a6 6 0 0 1-1.5 4M8 12a4 4 0 0 1 8 0v2.5a9 9 0 0 1-1.2 4.5M5 12a7 7 0 0 1 14 0M5 12v2c0 2 .4 3.6 1.2 5M12 8a1 1 0 0 0-1 1v2"/>
                  </svg>
                </div>
                <h3>Fingerprint Attendance</h3>
                <p>Connect fingerprint devices for sites where speed and reliability matter. Punches sync in real time.</p>
              </article>

              <article className="card">
                <div className="ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="8" r="3.2"/>
                    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5a3.2 3.2 0 0 1 0 6M18 14c2 .6 3.5 2.8 3.5 6"/>
                  </svg>
                </div>
                <h3>Employee Management</h3>
                <p>One profile for documents, roles, contracts and history. Org charts and bulk import included.</p>
              </article>

              <article className="card">
                <div className="ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3.5" y="5" width="17" height="15.5" rx="3"/>
                    <path d="M8 3v4M16 3v4M3.5 10h17M9 14.5l2 2 4-4"/>
                  </svg>
                </div>
                <h3>Leave Management</h3>
                <p>Custom leave policies, balances that update by themselves, and approvals in one tap.</p>
              </article>

              <article className="card">
                <div className="ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="6" width="18" height="13" rx="3"/>
                    <path d="M3 10.5h18M7 15h3"/>
                    <circle cx="16.5" cy="15" r="1.2"/>
                  </svg>
                </div>
                <h3>Payroll Management</h3>
                <p>Attendance flows straight into payroll. Handle overtime, deductions and payslips without re-entry.</p>
              </article>

              <article className="card">
                <div className="ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="8.5"/>
                    <path d="M12 7.5V12l3 2"/>
                  </svg>
                </div>
                <h3>Shift Management</h3>
                <p>Build rosters, rotate shifts and handle swaps. Spot gaps and overlaps before they happen.</p>
              </article>

              <article className="card">
                <div className="ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6"/>
                  </svg>
                </div>
                <h3>Real-time Analytics</h3>
                <p>Live dashboards for attendance, lateness, overtime and headcount. Export any report in seconds.</p>
              </article>

              <article className="card">
                <div className="ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="3.5"/>
                    <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>
                    <path d="M17.5 3.5l1 1 2-2"/>
                  </svg>
                </div>
                <h3>Employee Self-Service</h3>
                <p>Staff view payslips, apply for leave and fix attendance from their phone, with no HR ticket needed.</p>
              </article>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="how" id="solutions">
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">How it works</span>
              <h2>From sign-up to first payslip in four steps</h2>
              <p>Built for growing teams, factories, schools, clinics, retail chains and offices with more than one site.</p>
            </div>
            <div className="steps">
              <div className="step"><div className="num">1</div><h3>Set up your company</h3><p>Add locations, departments, shifts and leave rules. Import employees from a spreadsheet.</p></div>
              <div className="step"><div className="num">2</div><h3>Enrol your team</h3><p>Capture a face or fingerprint once. It takes less than ten seconds per person.</p></div>
              <div className="step"><div className="num">3</div><h3>Track attendance</h3><p>Employees check in at a device or kiosk. Every punch lands in your dashboard instantly.</p></div>
              <div className="step"><div className="num">4</div><h3>Run payroll</h3><p>Review the numbers, approve, and send payslips. Attendance and leave are already counted.</p></div>
            </div>
          </div>
        </section>

        {/* FACE SHOWCASE */}
        <section id="face">
          <div className="wrap split">
            <div>
              <span className="eyebrow">Face attendance</span>
              <h2>Check in with a look. Nothing to touch, nothing to forget.</h2>
              <p className="lead">
                Turn any tablet or kiosk into a secure attendance point. FlowPeople recognises your team, records the punch and tells HR right away.
              </p>
              <ul className="checks">
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                  <span><b>Liveness detection.</b> Blocks photos, videos and masks.</span>
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                  <span><b>Works in real conditions.</b> Handles glasses, beards, masks and low light.</span>
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                  <span><b>Geo-fenced punches.</b> Only valid at approved sites.</span>
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                  <span><b>Instant alerts.</b> Late, missed and unknown faces are flagged live.</span>
                </li>
              </ul>
              <div className="hero-ctas">
                <button className="btn btn-primary" onClick={() => onNavigateRegister()}>Try Face Attendance Free</button>
                <button className="btn btn-ghost" onClick={onNavigateKiosk}>Launch Live Kiosk Terminal</button>
              </div>
            </div>

            <div className="kiosk-col">
              <div className="kiosk">
                <div className="kiosk-top"><b>FlowPeople Kiosk</b><span>Main Gate · 09:02 AM</span></div>
                <div className="scan">
                  <i className="corner c1"></i><i className="corner c2"></i><i className="corner c3"></i><i className="corner c4"></i>
                  <svg className="face" viewBox="0 0 120 150" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <ellipse cx="60" cy="72" rx="36" ry="46"/>
                    <path d="M42 64h10M68 64h10M60 66v18l-5 2M48 100c7 6 17 6 24 0M30 60c0-24 14-34 30-34s30 10 30 34"/>
                    <circle cx="60" cy="72" r="1" fill="currentColor"/>
                  </svg>
                  <span className="line"></span>
                </div>
                <div className="result">
                  <span className="av">PS</span>
                  <div><b>Priya Sharma</b><small>Design · Shift A</small></div>
                  <span className="ok">✓ Checked in</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DASHBOARD PREVIEW TABS */}
        <section className="preview">
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">Dashboard</span>
              <h2>See your whole workforce at a glance</h2>
              <p>Switch views to explore how FlowPeople keeps each part of HR in one place.</p>
            </div>
            <div className="tabs">
              <button 
                className={`tab ${activeTab === 'attendance' ? 'active' : ''}`}
                onClick={() => setActiveTab('attendance')}
              >
                Attendance
              </button>
              <button 
                className={`tab ${activeTab === 'leave' ? 'active' : ''}`}
                onClick={() => setActiveTab('leave')}
              >
                Leave
              </button>
              <button 
                className={`tab ${activeTab === 'payroll' ? 'active' : ''}`}
                onClick={() => setActiveTab('payroll')}
              >
                Payroll
              </button>
            </div>

            <div className="dash big-dash">
              <div className="dash-bar"><i></i><i></i><i></i><em>app.flowpeople.com</em></div>
              <div style={{ padding: '22px' }}>
                {activeTab === 'attendance' && (
                  <div>
                    <div className="kpis" style={{ marginBottom: '16px' }}>
                      <div className="kpi"><small>Present</small><strong>1,174</strong><em>94.1%</em></div>
                      <div className="kpi"><small>Late arrivals</small><strong>41</strong><em>-12% vs last week</em></div>
                      <div className="kpi"><small>Overtime hours</small><strong>312</strong><em>Within budget</em></div>
                    </div>
                    <div className="panel tbl-wrap">
                      <table className="tbl">
                        <thead>
                          <tr><th>Employee</th><th>Method</th><th>In</th><th>Out</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                          <tr><td>Priya Sharma</td><td>Face</td><td>09:02</td><td>—</td><td><span className="pill" style={{ margin: 0 }}>On time</span></td></tr>
                          <tr><td>Rahul Kulkarni</td><td>Fingerprint</td><td>08:57</td><td>—</td><td><span className="pill" style={{ margin: 0 }}>On time</span></td></tr>
                          <tr><td>Anita Menon</td><td>Face</td><td>09:18</td><td>—</td><td><span className="pill late" style={{ margin: 0 }}>Late 18m</span></td></tr>
                          <tr><td>Vikram Rao</td><td>Face</td><td>08:49</td><td>—</td><td><span className="pill" style={{ margin: 0 }}>On time</span></td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'leave' && (
                  <div>
                    <div className="panel tbl-wrap">
                      <table className="tbl">
                        <thead>
                          <tr><th>Employee</th><th>Type</th><th>Dates</th><th>Balance used</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                          <tr><td>Neha Joshi</td><td>Annual</td><td>10–14 Nov</td><td><div className="progress"><i style={{ width: '40%' }}></i></div></td><td><span className="pill" style={{ margin: 0 }}>Approved</span></td></tr>
                          <tr><td>Sameer Patil</td><td>Sick</td><td>3 Nov</td><td><div className="progress"><i style={{ width: '15%' }}></i></div></td><td><span className="pill" style={{ margin: 0 }}>Approved</span></td></tr>
                          <tr><td>Kavya Iyer</td><td>Annual</td><td>20–24 Nov</td><td><div className="progress"><i style={{ width: '62%' }}></i></div></td><td><span className="pill late" style={{ margin: 0 }}>Pending</span></td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'payroll' && (
                  <div>
                    <div className="kpis" style={{ marginBottom: '16px' }}>
                      <div className="kpi"><small>Payroll this month</small><strong>₹84.2L</strong><em>Ready to review</em></div>
                      <div className="kpi"><small>Payslips generated</small><strong>1,248</strong><em>100%</em></div>
                      <div className="kpi"><small>Exceptions</small><strong>6</strong><em>Needs review</em></div>
                    </div>
                    <div className="panel">
                      <h5>Payroll cost by department</h5>
                      <div className="bars" style={{ height: '110px' }}>
                        <span style={{ height: '88%' }}></span>
                        <span style={{ height: '64%' }}></span>
                        <span style={{ height: '72%' }}></span>
                        <span style={{ height: '48%' }}></span>
                        <span style={{ height: '56%' }}></span>
                        <span style={{ height: '36%' }}></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* SECURITY & PRIVACY */}
        <section id="security">
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">Security &amp; privacy</span>
              <h2>Biometric data deserves the highest care</h2>
              <p>FlowPeople is built so your people's data stays protected, private and under your control.</p>
            </div>
            <div className="sec-grid">
              <article className="card">
                <div className="ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4.5" y="10.5" width="15" height="10" rx="3"/>
                    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 15v2"/>
                  </svg>
                </div>
                <h3>Encrypted end to end</h3>
                <p>Data is encrypted in transit and at rest. Biometric templates are stored as encrypted math, not as photos.</p>
              </article>

              <article className="card">
                <div className="ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="15" r="4"/>
                    <path d="M11 12l8-8M16 7l2.5 2.5"/>
                  </svg>
                </div>
                <h3>Role-based access</h3>
                <p>Decide exactly who can see salaries, documents and attendance. Every permission is yours to set.</p>
              </article>

              <article className="card">
                <div className="ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 3.5h9l3.5 3.5v13.5H6z"/>
                    <path d="M9 11h6M9 14.5h6M9 18h3"/>
                  </svg>
                </div>
                <h3>Full audit trail</h3>
                <p>Every change to a record is logged with who, what and when, ready for audits.</p>
              </article>

              <article className="card">
                <div className="ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/>
                    <circle cx="12" cy="12" r="2.8"/>
                  </svg>
                </div>
                <h3>Consent and privacy controls</h3>
                <p>Record employee consent for biometric capture, set retention periods and delete data on request.</p>
              </article>

              <article className="card">
                <div className="ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3.5" y="4" width="17" height="6.5" rx="2"/>
                    <rect x="3.5" y="13.5" width="17" height="6.5" rx="2"/>
                    <path d="M7 7.2h.01M7 16.8h.01"/>
                  </svg>
                </div>
                <h3>Reliable cloud</h3>
                <p>Daily backups and a resilient setup keep your records safe and available.</p>
              </article>

              <article className="card">
                <div className="ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l7.5 3v5.5c0 4.5-3.1 8-7.5 9.5-4.4-1.5-7.5-5-7.5-9.5V6L12 3z"/>
                    <path d="M9 12l2.2 2.2L15.5 10"/>
                  </svg>
                </div>
                <h3>Anti-spoofing</h3>
                <p>Liveness checks and device binding help make sure the person at the kiosk is really them.</p>
              </article>
            </div>

            <div className="sec-banner">
              <div>
                <h3>Your data is never sold or shared.</h3>
                <p>Biometric data is used only for attendance and is never used for advertising or sold to third parties.</p>
              </div>
              <a className="btn btn-primary" style={{ background: '#fff', color: 'var(--teal-700)', boxShadow: 'none' }} href="#faq">
                Read security FAQs
              </a>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="pricing" id="pricing">
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">Pricing</span>
              <h2>Simple pricing that grows with you</h2>
              <p>Pay per employee per month. Start free for 14 days. Cancel any time.</p>
            </div>

            <div className="toggle">
              <span>Monthly</span>
              <button 
                className={`switch ${isYearly ? 'checked' : ''}`}
                onClick={() => setIsYearly(!isYearly)}
                role="switch"
                aria-checked={isYearly}
                aria-label="Toggle annual billing discount"
              />
              <span>Yearly <span className="save">Save 20%</span></span>
            </div>

            <div className="plans">
              <article className="plan">
                <h3>Starter</h3>
                <p className="sub">For small teams getting off spreadsheets.</p>
                <div className="price">
                  <span>{isYearly ? '₹39' : '₹49'}</span>
                  <small> / employee / month</small>
                </div>
                <ul>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                    Employee management
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                    Face or fingerprint attendance
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                    Leave management
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                    Self-service app
                  </li>
                </ul>
                <button className="btn btn-ghost" onClick={() => onNavigateRegister('starter')}>Start Free Trial</button>
              </article>

              <article className="plan pop">
                <span className="badge">Most popular</span>
                <h3>Growth</h3>
                <p className="sub">For growing companies that run payroll in-house.</p>
                <div className="price">
                  <span>{isYearly ? '₹79' : '₹99'}</span>
                  <small> / employee / month</small>
                </div>
                <ul>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                    Everything in Starter
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                    Payroll and payslips
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                    Shift and roster management
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                    Real-time analytics
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                    Multiple locations
                  </li>
                </ul>
                <button className="btn btn-primary" onClick={() => onNavigateRegister('professional')}>Start Free Trial</button>
              </article>

              <article className="plan">
                <h3>Enterprise</h3>
                <p className="sub">For large organisations with custom needs.</p>
                <div className="price">
                  <span>Custom</span>
                </div>
                <ul>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                    Everything in Growth
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                    Custom roles and approvals
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                    Dedicated onboarding
                  </li>
                  <li>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                    Priority support
                  </li>
                </ul>
                <button className="btn btn-ghost" onClick={() => onNavigateRegister('enterprise')}>Talk to Sales</button>
              </article>
            </div>

            <p className="note">Includes 14-day unrestricted trial. No credit card required to start.</p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq">
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">FAQ</span>
              <h2>Questions customers ask us</h2>
            </div>
            <div className="faq">
              <details open>
                <summary>How does face recognition attendance work?</summary>
                <p>Employees enrol once with a short face capture. After that, they look at a tablet or kiosk and the system matches them, checks liveness and records the punch in about two seconds.</p>
              </details>
              <details>
                <summary>Do you store photos of my employees' faces?</summary>
                <p>FlowPeople stores an encrypted biometric template instead of a usable photo. You control retention and can delete a person's data at any time.</p>
              </details>
              <details>
                <summary>Can we use fingerprint devices as well?</summary>
                <p>Yes. You can use face, fingerprint or both, and mix methods across locations. All punches appear in the same attendance records.</p>
              </details>
              <details>
                <summary>Does attendance connect to payroll?</summary>
                <p>Yes. Attendance, overtime and approved leave flow into payroll automatically, so there is no copying between files.</p>
              </details>
              <details>
                <summary>Can employees use it on their phones?</summary>
                <p>Yes. Employee self-service lets people view payslips, apply for leave and request attendance fixes from their phone or laptop.</p>
              </details>
              <details>
                <summary>How long does setup take?</summary>
                <p>Most teams are live within a day. You import employees from a spreadsheet, set policies and start enrolling faces or fingerprints.</p>
              </details>
              <details>
                <summary>Is there a free trial?</summary>
                <p>
                  Yes, 14 days free with no credit card needed.{' '}
                  <span onClick={() => onNavigateRegister()} style={{ color: 'var(--teal-600)', fontWeight: 600, cursor: 'pointer' }}>
                    Start your free trial
                  </span>.
                </p>
              </details>
            </div>
          </div>
        </section>

        {/* ABOUT */}
        <section id="about" style={{ paddingBottom: '48px' }}>
          <div className="wrap split">
            <div>
              <span className="eyebrow">About</span>
              <h2>Made by FlowCraft for the people who run teams</h2>
              <p className="lead">
                FlowCraft builds software that makes everyday work flow. FlowPeople is our HRMS: simple enough for a small business, strong enough for large teams, and designed around people rather than paperwork.
              </p>
              <a className="btn btn-ghost" href="#features">See what's inside</a>
            </div>
            <div className="grid-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="card">
                <div className="ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/></svg>
                </div>
                <h3>Fast</h3>
                <p>Quick to set up and quick to use.</p>
              </div>
              <div className="card">
                <div className="ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7.5 3v5.5c0 4.5-3.1 8-7.5 9.5-4.4-1.5-7.5-5-7.5-9.5V6L12 3z"/><path d="M9 12l2.2 2.2L15.5 10"/></svg>
                </div>
                <h3>Safe</h3>
                <p>Privacy first for every record.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA BANNER */}
        <section className="cta">
          <div className="wrap">
            <div className="cta-box">
              <h2>Ready to simplify people management?</h2>
              <p>Start your free 14-day trial. Be up and running today.</p>
              <div className="row">
                <button className="btn btn-primary" onClick={() => onNavigateRegister()}>Start Free Trial</button>
                <button className="btn btn-ghost" onClick={onNavigateLogin}>Login</button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer>
        <div className="wrap">
          <div className="foot-grid">
            <div>
              <div className="logo cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                <Logo variant="full" size={36} colorMode="dark" />
              </div>
              <p>Intelligent HR management and biometric attendance, by FlowCraft.</p>
            </div>
            <div>
              <h4>Product</h4>
              <ul>
                <li><a href="#features">Features</a></li>
                <li><a href="#face">Face attendance</a></li>
                <li><a href="#pricing">Pricing</a></li>
                <li><a href="#security">Security</a></li>
              </ul>
            </div>
            <div>
              <h4>Company</h4>
              <ul>
                <li><a href="#about">About FlowCraft</a></li>
                <li><a href="#faq">FAQ</a></li>
                <li><a href="mailto:hello@flowcraft.in">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4>Get started</h4>
              <ul>
                <li><a onClick={() => onNavigateRegister()} style={{ cursor: 'pointer' }}>Start Free Trial</a></li>
                <li><a onClick={onNavigateLogin} style={{ cursor: 'pointer' }}>Login</a></li>
              </ul>
            </div>
          </div>

          <div className="foot-bottom">
            <span>© 2026 FlowCraft. All rights reserved.</span>
            <span className="by">FlowPeople is a product of FlowCraft</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
