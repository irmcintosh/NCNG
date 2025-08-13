# NCNG Web Map Template Saver

![NCNG Web Map Template Saver Screenshot](Screenshot%202025-08-13%20065800.png)

## Overview

The **NCNG Web Map Template Saver** is a custom ArcGIS Online companion application developed for the **North Carolina National Guard (NCNG)**.  
Its primary purpose is to allow authorized users to quickly and consistently save standardized copies of ArcGIS web map templates, following NCNG’s naming and organizational conventions.

This tool streamlines the process of creating operationally consistent maps by enforcing title formats, folder organization, and tagging conventions.

---

## Purpose

Operational mapping within the NCNG requires **consistency**, **speed**, and **organization**.  
This application was designed to:

- Save copies of official NCNG web map templates to a user's ArcGIS Online content.
- Apply **naming conventions** that follow the format:
- - Default certain fields (like **Fiscal Year**) to reduce repetitive manual input.
- Allow users to **select an existing folder** or **create a new folder** for storage.
- Support **tags**, **summaries**, and **descriptions** to improve discoverability in ArcGIS Online.

---

## Features

- **ArcGIS Online Authentication** – Secure OAuth 2.0 PKCE sign-in.
- **Auto-generated Titles** – Based on NCNG operational naming standards.
- **Default Fiscal Year** – Automatically populates the current NCNG fiscal year.
- **Folder Management** – Choose existing folders or create new ones directly in the app.
- **Tagging Support** – Helps organize and locate content in ArcGIS Online.
- **User-Friendly Interface** – Designed for efficiency in emergency or operational contexts.

---

## Usage

1. **Sign In to ArcGIS**  
 Click **"Sign in to ArcGIS"** to authenticate with your NCNG ArcGIS Online account.

2. **Fill in Metadata Fields**  
 - **Portfolio/Mission** – High-level operational category (e.g., `SAD`, `IEMAC`, `OPS`).
 - **Environment** – Select `AGOL` or `PORTAL`.
 - **Purpose** – Describe the map’s intended use (auto-formatted to PascalCase).
 - **Owner** – Enter the owning section or unit (auto-formatted to UPPERCASE).
 - **Fiscal Year** – Defaults automatically (e.g., `FY25`).
 - **Tags, Summary, Description** – Optional metadata for search/discovery.

3. **Choose Save Location**  
 - Select **Use existing** to choose an existing folder, or
 - Select **Create new** and enter a new folder name.

4. **Save**  
 Click **"Save My Copy"** to create a personal copy of the template in your ArcGIS Online account.

---

## Example Workflow

1. Portfolio: `SAD`
2. Environment: `AGOL`
3. Purpose: `Collaboration`
4. Owner: `GEO`
5. Fiscal Year: `FY25` (auto)
6. Tags: `NCNG, SAD, Collaboration`
7. Save to folder: `OPS 2025`

**Generated Title:**  

---

## Technical Notes

- **Authentication:** Uses Esri's `@esri/arcgis-rest-auth` PKCE OAuth 2.0 flow.
- **ArcGIS Content API:** Saves templates via `@esri/arcgis-rest-portal`.
- **Framework:** Built with React + TypeScript + Vite.
- **UI:** Styled for quick operational data entry and compliance with NCNG style guidelines.

---

## Contact

For questions, support, or access requests, contact:  
📧 **NGNC-GIS@army.mil**

---

## Terms of Use

This application is for **official use only** by authorized NCNG personnel.  
By using this application, you agree to abide by all NCNG and NCDPS policies.  
Redistribution or public sharing without written authorization is prohibited.

---


