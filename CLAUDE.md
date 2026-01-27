# Project Rules for Monterico App

DO NEVER WRITE MARKDOWN OR TEXT FILES WITH SUMMARIES OF CHANGES AT THE END OF CONVERSATIONS.

## General Guidelines
- Always use TypeScript with proper typing
- Follow Next.js 14+ App Router conventions
- Use shadcn/ui components whenever possible - never create custom UI components when shadcn equivalents exist
- Maintain consistent code formatting and structure with the existing codebase
- Do not create mardown or text files with summaries of changes at the end of conversations
- Do not create custom shell scripts or automation tools at the end of conversations or to show feature or do something.

## UI/UX Rules
1. **Always use shadcn/ui components** - Check the `/src/components/ui` directory first before creating any UI element
2. **No duplicate page headers** - Main navigation already shows where users are, don't add redundant titles on pages
3. **Consistent spacing** - Use Tailwind's spacing utilities (space-y-6, gap-4, etc.) for consistent layouts
4. **Visual feedback** - Always provide hover states, loading states, and disabled states for interactive elements
5. **Clean and minimal** - Avoid cluttered interfaces, remove unnecessary elements

## Code Organization
- Place reusable components in `/src/components`
- Keep page-specific logic in page files
- Use custom hooks in `/src/hooks` for shared logic
- API routes go in `/src/app/api`

## Styling
- Use Tailwind CSS utility classes exclusively
- Follow the existing color scheme (primary, secondary, muted, destructive)
- Use semantic color names (e.g., `text-muted-foreground` instead of `text-gray-500`)
- Responsive design: mobile-first approach with md:, lg: breakpoints
- Do not add comments UNLESS ABSOLUTELY NECESSARY to understand the code

## Data Handling
- Use Server Components where possible for better performance
- Client components only when needed (use "use client" directive)
- Proper error handling with try-catch and toast notifications
- Always validate data before sending to API

## Accounting Modes
The app has two accounting modes: "individual" and "shared_pool"
- See existing code for implementation details and conditional rendering patterns
- Check `/src/app/settings/page.tsx` for mode configuration
- Look at expense/income pages for mode-specific features
- The code is the source of truth for what features belong to which mode

## Forms & Validation
- Use controlled components with React state
- Show validation errors inline
- Disable submit buttons during form submission
- Clear forms after successful submission
- Use toast notifications for success/error feedback (not `variant` prop - that doesn't exist)

## Common Patterns
- Use `formatCurrency()` from `/src/lib/utils` for displaying money
- Filter active users with `.filter(u => u.isActive)` when needed
- Use Dialog components for forms and confirmations
- Use Card components for content sections
- Use Tabs for organizing related content

## Things to Avoid
- Don't use `variant` prop on toast notifications (use `type` instead)
- Don't create custom switches, checkboxes, or inputs - use shadcn components
- Don't hardcode routes - the app structure is well-defined
- Don't remove the accounting mode indicator from MainNav
- Don't use inline styles - use Tailwind classes
- Don't create overly complex state management - keep it simple
- Don't create markdown or text files with summaries of changes at the end of conversations

## File Naming
- Page files: `page.tsx`
- Components: PascalCase (e.g., `UserCard.tsx`)
- Utilities: camelCase (e.g., `formatDate.ts`)
- API routes: `route.ts`

## When Making Changes
1. Check existing patterns in the codebase first
2. Ensure changes work for both accounting modes
3. Test responsive behavior (mobile, tablet, desktop)
4. Verify no TypeScript errors with diagnostics
5. Remove unused imports and variables
6. Follow the existing code style exactly
