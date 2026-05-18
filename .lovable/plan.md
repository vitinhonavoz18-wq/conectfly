I will improve the checkout flow in the `SiteCartDrawer` component to guide customers when information is missing.

### Improvements:
- **Validation & Guidance**: When clicking "Finalizar pedido" with incomplete data, the system will prevent submission and identify which fields are missing.
- **Auto-Scroll & Focus**: The screen will automatically scroll to the first empty required field and focus it.
- **Visual Feedback**:
  - Missing fields will be highlighted with a red border.
  - A friendly message "Quase lá! Preencha seus dados para finalizar o pedido. 🍕" will appear near the fields.
- **Mobile Optimization**: Using `scrollIntoView` with a centered block alignment to ensure fields aren't hidden by sticky UI elements.
- **Required Fields**: Name, Phone, Address, Neighborhood (if delivery zones exist), Payment Method, and Change (if paying with cash).

### Technical Details:
- Use `useRef` to target specific input elements.
- Add `validationAttempted` state to manage conditional error styling.
- Update `handleFinish` logic to implement step-by-step field verification.
- Ensure the focus and scroll work correctly within the `flex-1 overflow-y-auto` container of the drawer.
