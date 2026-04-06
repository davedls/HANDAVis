HANDAVis Western Visayas Upgrade

Files:
- alert.php
- live_alerts_feed.php
- generate_plan_pdf.php
- assets/css/user_alerts.css
- assets/js/user_alerts.js

What changed:
- Live advisory feed is now Western Visayas only.
- Priority sources are PAGASA VIS_PRSD, PAGASA weather advisory, Iloilo CDRRMO, PIA disaster information, and Bacolod City Government when relevant.
- The radar now behaves more like a local threat-and-route console:
  - selected Western Visayas city center
  - live weather radar overlay for flood/storm
  - threat rings
  - safe points
  - route line
  - strongest live trigger card
- Fire mode still uses route rings + live local/official reports because no verified public real-time fire dispatch radar feed was wired.

Placement:
project-root/
├── alert.php
├── live_alerts_feed.php
├── generate_plan_pdf.php
├── assets/
│   ├── css/user_alerts.css
│   └── js/user_alerts.js
└── fpdf/
    ├── fpdf.php
    └── font/

Notes:
- Open through localhost or your PHP server.
- live_alerts_feed.php must be in the same root level as alert.php.
- generate_plan_pdf.php still needs the FPDF folder in the project root.
