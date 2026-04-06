# HANDAVis 🚨

## A Community-Based, Real-Time Emergency Response Platform for Western Visayas

HANDAVis (HANDA + Visayas) is a *comprehensive, multi-portal emergency response system* designed to enhance disaster preparedness, response coordination, and public safety across *Western Visayas*. It integrates *real-time data, intelligent routing, AI-driven assistance, and community collaboration* into a single, unified platform.

The system is engineered to reduce response time, improve situational awareness, and empower both citizens and authorities to act quickly and effectively during emergencies.

---

## 1. Objectives

HANDAVis aims to:

* Provide *real-time situational awareness* during disasters
* Enable *fast and reliable emergency communication*
* Improve *coordination between civilians, responders, and local authorities*
* Support *data-driven evacuation and response decisions*
* Strengthen *community resilience* through connected systems

---

## 2. System Architecture Overview

HANDAVis follows a *multi-role, web-based architecture* composed of four primary portals:

* User Portal
* Barangay Staff Portal
* Responder Portal
* Admin Portal

Each portal has *role-based access control (RBAC)* to ensure secure and appropriate system usage.

---

## 3. System Portals

### 3.1 User Portal

The User Portal is designed for general users and community members.

*Key Functions:*

* Trigger *SOS alerts* with real-time location
* Submit *one-tap hazard reports*
* View *real-time map data* (hazards, alerts, safe zones)
* Access *live weather forecasts and news updates*
* Receive *smart evacuation route recommendations*
* Manage *Circle (trusted contacts)* and monitor their safety status

---

### 3.2 Barangay Staff Portal

This portal supports local government units at the barangay level.

*Key Functions:*

* Monitor *localized incidents and reports*
* Validate and manage *hazard submissions*
* Track *SOS alerts within jurisdiction*
* Coordinate with responders and community members
* Update incident statuses

---

### 3.3 Responder Portal

Used by emergency personnel such as rescue teams and medical responders.

*Key Functions:*

* Receive *real-time SOS alerts*
* View *exact user locations*
* Navigate using *optimized evacuation routes*
* Access *live hazard maps*
* Update response progress and status

---

### 3.4 Admin Portal

Provides centralized control and system-wide oversight.

*Key Functions:*

* Manage *users, roles, and permissions*
* Monitor *all system activities and reports*
* Maintain *data integrity and system performance*
* Oversee platform operations and analytics

---

## 4. Core System Features

### 4.1 Real-Time Tracking

* Continuous location tracking of users and incidents
* Enables faster identification and response to emergencies

### 4.2 Real-Time News Integration

* Aggregates disaster-related news updates
* Ensures users are informed of ongoing regional events

### 4.3 Real-Time Weather Forecast

* Displays live weather data
* Supports proactive decision-making and risk assessment

### 4.4 One-Tap Hazard Reporting

Users can instantly report hazards, including:

* Flood
* Fire
* Storm
* Earthquake / Ashfall
* Roadblocks
* Medical emergencies

Reports are visualized on the system map with *distinct color indicators*.

### 4.5 SOS Emergency System

* Immediate alert mechanism
* Sends notifications to:

  * Circle members
  * Responders
  * System administrators
* Includes real-time geolocation data

### 4.6 Smart Evacuation Route Recommendation

* Generates optimal evacuation paths
* Considers:

  * Active hazards
  * Road conditions
  * Safety zones

### 4.7 Circle Feature (Community Network)

* Allows users to create a trusted network
* Features include:

  * Safety status monitoring
  * Emergency alert sharing
  * Real-time updates among members

### 4.8 HANDAm AI Assistance

* AI-powered assistant trained for disaster-related support
* Capabilities include:

  * Answering emergency-related queries
  * Providing safety procedures
  * Delivering real-time guidance

---

## 5. System Workflow

1. User logs into the system and enables location services
2. Dashboard displays:

   * Real-time map
   * Weather updates
   * News feed
3. In case of emergency:

   * User triggers SOS or reports hazard
4. System processes and:

   * Notifies relevant parties (circle, responders, admin)
   * Updates map and system data in real time
5. Responders act using provided location and route data
6. Incident is resolved and status is updated

---

## 6. Problem Statement

Current emergency response systems face several challenges:

* Delayed response times
* Lack of real-time, centralized information
* Inefficient coordination between stakeholders
* Unsafe or unclear evacuation planning

---

## 7. Proposed Solution

HANDAVis addresses these issues by:

* Centralizing emergency data into one platform
* Enabling real-time communication and updates
* Providing intelligent routing and AI assistance
* Empowering both authorities and civilians to participate in response efforts

---

## 8. Expected Impact

* Reduced emergency response time
* Improved disaster awareness and preparedness
* Enhanced coordination among responders and communities
* Increased safety and survival rates during disasters

---

## 9. Technology Stack

*Frontend:*

* HTML
* CSS
* JavaScript

*Backend:*

* PHP
* MySQL

*Integrations:*

* Google Maps API / Mapbox
* Weather API
* News API
* AI Integration (HANDAm)

---

## 10. Future Enhancements

* Mobile application (Flutter-based)
* Push notification system
* Offline functionality (SMS-based alerts)
* Integration with hospitals, police, and LGUs
* Advanced analytics and reporting dashboard

---

## 11. Deployment Guide (HelioHost)

HANDAVis is deployed using *HelioHost*, a free web hosting service that supports PHP and MySQL.

### Requirements

* HelioHost account
* FTP client (e.g., FileZilla)
* Database access via HelioHost dashboard

### Steps to Deploy

1. *Create a HelioHost Account*

   * Register at [https://www.heliohost.org](https://www.heliohost.org)
   * Choose a hosting server and wait for activation

2. *Upload Project Files*

   * Open FileZilla (or any FTP client)
   * Connect using your HelioHost credentials
   * Upload project files to the public_html directory

3. *Set Up Database*

   * Log in to HelioHost dashboard
   * Create a new MySQL database
   * Import your .sql file using phpMyAdmin

4. *Configure Database Connection*

   * Open your config file (e.g., config.php)
   * Update the following:

     * Host (usually localhost or provided by HelioHost)
     * Database name
     * Username
     * Password

5. *Run the System*

   * Open your browser and go to:
     https://yourdomain.heliohost.org

---

### Notes

* Ensure all file paths are correct after upload
* Enable error reporting for debugging if needed
* Some APIs (Maps, Weather, News) may require valid API keys

HANDAVis is designed to run on a live server environment, making it accessible anytime and anywhere.

---

## 12. Usage Guidelines

* Register and log into the platform
* Enable location services
* Add trusted contacts to Circle
* Monitor real-time updates
* Use SOS and hazard reporting features responsibly

---

## 13. Conclusion

HANDAVis represents a *modern, scalable, and community-driven approach* to emergency management. By integrating real-time systems, AI, and multi-role coordination, it provides a powerful tool for improving disaster response across Western Visayas.

"Empowering communities through real-time intelligence and connected response systems."

HelioHost | Free Hosting
www.heliohost.org
