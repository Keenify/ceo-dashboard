# OPPP (One-Page Personal Plan) Documentation

This directory contains all documentation and reference materials for the OPPP feature implementation.

## Directory Structure

```
docs/oppp/
├── README.md                    # This file - overview and navigation
├── OPPP_SETUP.md               # Implementation setup guide
├── database/
│   └── OPPP_COMPLETE_SETUP.sql # Complete database setup script
└── reference/
    ├── oppp_empty_form.pdf     # PDF reference of the form layout
    └── oppp_empty_form.png     # PNG reference of the form layout
```

## Quick Navigation

### 🚀 Getting Started
- **[OPPP_SETUP.md](./OPPP_SETUP.md)** - Complete setup and implementation guide

### 🗄️ Database Setup
- **[OPPP_COMPLETE_SETUP.sql](./database/OPPP_COMPLETE_SETUP.sql)** - Run this SQL script in Supabase to set up the database

### 📋 Reference Materials
- **[oppp_empty_form.pdf](./reference/oppp_empty_form.pdf)** - Original form design reference (PDF)
- **[oppp_empty_form.png](./reference/oppp_empty_form.png)** - Original form design reference (PNG)

## Implementation Overview

The OPPP feature allows users to create and manage their One-Page Personal Plans with the following structure:

### Form Sections
1. **Faith** - 10-25 Years (Aspirations)
2. **Family** - 1 Year (Activities)
3. **Friends** - Start (90 Days Actions)
4. **Fitness** - Stop (90 Days Actions)
5. **Finance** - Combined row with white background

### Categories
Each section (except Finance) has four categories:
- Relationships
- Achievements
- Rituals
- Wealth ($)

### Key Features
- Date-based form storage
- Real-time auto-save
- Confirmation modal for deletion
- Responsive design matching reference layout
- Row-specific timeframe badges that auto-expand

## Technical Implementation

### Frontend Structure
```
app/oppp/
├── page.tsx              # Main OPPP form component
├── services/
│   └── useOPPP.ts       # API service hooks
├── types.ts             # TypeScript type definitions
└── constants/           # Configuration constants
```

### Database Schema
- Table: `oppp_form`
- Row Level Security enabled
- User-specific data isolation
- JSONB storage for form data flexibility

## Development Notes

### Form Layout Requirements
- Timeframe badges must span full height of their corresponding rows
- "90 Days (Actions)" spans Friends, Fitness, and Finance rows
- Finance row has merged content area with white background
- No visible border between Fitness and Finance rows

### Data Structure
```typescript
{
  "10-25_years": { relationships: [], achievements: [], rituals: [], wealth: [] },
  "1_year": { relationships: [], achievements: [], rituals: [], wealth: [] },
  "start": { relationships: [], achievements: [], rituals: [], wealth: [] },
  "stop": { relationships: [], achievements: [], rituals: [], wealth: [] }
}
```

## Maintenance

For future updates or modifications:
1. Refer to reference images for visual accuracy
2. Maintain data structure consistency
3. Ensure proper TypeScript typing
4. Test database migrations before production deployment