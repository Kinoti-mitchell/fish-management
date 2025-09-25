# RIO FISH FARM - Design System Guidelines

## General Guidelines

* Use size-based fish organization (0-10 scale) - NO fish species/types classification
* Maintain the blue color scheme (#2563eb primary) throughout the application  
* Use consistent spacing and typography from globals.css
* Prioritize clean, professional layouts over busy/cluttered designs
* Focus on Kenyan fish farming context (Homabay farmers, major Kenyan cities)

## Fish Organization System

* **Size Scale**: 0-10 where:
  - Size 10: 2.5+ kg (largest)
  - Size 0: 0.1-0.2 kg (smallest)
  - Sizes 0-10 are ready for dispatch
  - Sizes above 10 need further processing

* **No Species Classification**: Remove all references to fish types like "Tilapia", "Catfish", "Nile Perch" etc.
* **Grade System**: A (Premium), B (Standard), C (Basic)

## Color System

* **Primary**: #2563eb (Blue 600)
* **Secondary**: Light blue variations for accents
* **Status Colors**:
  - Ready/Success: Green (emerald-500)
  - Processing: Blue (blue-500) 
  - Warning: Orange (orange-500)
  - Error: Red (red-500)

## Typography

* **Base Font Size**: 14px
* **Headings**: Semi-bold with tight tracking
* **Body Text**: Regular weight, good line height
* **Small Text**: Muted foreground color for secondary info

## Component Styling

### Cards
* Use clean shadows (card-shadow, card-shadow-lg classes)
* Consistent padding: card-compact (p-4), card-comfortable (p-6), card-spacious (p-8)
* Hover effects with subtle transitions

### Status Indicators  
* Use Badge components with appropriate colors
* Size indicators: Blue for small, Green for medium, Purple for large
* Clear visual hierarchy

### Forms
* Use form-grid, form-grid-2, form-grid-3 classes for consistent layouts
* Proper focus states and transitions
* Clear labels and helpful placeholder text

### Data Display
* Use data-grid, data-item, data-label, data-value classes
* Consistent spacing and alignment
* Clear visual hierarchy between labels and values

## Layout Principles

* **Mobile-first**: Responsive design that works on all devices
* **Clean Navigation**: Organized by workflow (Entry → Processing → Inventory → Orders → Dispatch)
* **Logical Grouping**: Related functions grouped together
* **Clear Actions**: Primary actions stand out, secondary actions are subtle
* **Consistent Spacing**: Use standard gap values (gap-4, gap-6, etc.)

## Content Guidelines

* **Kenyan Context**: All locations, phone numbers, and names should be Kenyan
* **Currency**: Always use KES (Kenyan Shillings)
* **Locations**: Homabay County for farms, major cities (Nairobi, Mombasa, Kisumu, Nakuru) for outlets
* **Professional Tone**: Business-focused language appropriate for warehouse operations

## Performance & Accessibility

* **Smooth Animations**: Use transition-all with appropriate durations
* **Focus States**: Clear keyboard navigation indicators  
* **Color Contrast**: Ensure proper contrast ratios
* **Responsive**: Works well on mobile and desktop
* **Fast Loading**: Minimal unnecessary animations or effects