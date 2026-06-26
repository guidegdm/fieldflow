# FieldFlow

## Inspiration

I come from the eastern Democratic Republic of the Congo, a region where communities have lived through repeated humanitarian crises, displacement, insecurity, and limited access to essential services. In many areas, internet connectivity is unstable or unavailable, yet humanitarian workers, health facilities, local organizations, and public agencies are still expected to register people, coordinate assistance, manage supplies, and make urgent decisions.

When connectivity disappears, many digital systems stop working. Teams are often forced to return to paper forms, spreadsheets, phone calls, or WhatsApp messages. Information may then be entered several times, lost, delayed, or duplicated. In a humanitarian operation, this is not only a technical inconvenience: it can mean that a family is registered twice, medicine is allocated incorrectly, or decision-makers receive information too late.

That reality inspired us to build **FieldFlow**.

## What FieldFlow Does

FieldFlow is an offline-first platform that allows organizations to create and deploy operational web applications for environments with unreliable internet.

An organization can use FieldFlow to design workflows such as:

- Humanitarian beneficiary registration
- Food and non-food item distribution
- Patient intake and medical referrals
- Agricultural field inspections
- Warehouse and inventory management
- Community surveys
- Construction-site reporting

An administrator defines the information to collect, user roles, approval stages, validation rules, and critical actions. FieldFlow then transforms this configuration into an installable Progressive Web App that field workers can use on laptops, tablets, or phones.

Workers can continue registering people, collecting information, capturing evidence, and completing assigned tasks while offline. Their work is stored securely on the device and synchronized when connectivity becomes available again.

## How It Works

FieldFlow treats each local change as a traceable operation instead of repeatedly replacing an entire record.

For example, when a field worker updates a household's phone number, the system records:

- The record that was changed
- The previous and new values
- The worker and device responsible
- The workflow version
- Whether the action happened online or offline
- The synchronization status

When two devices edit different parts of the same record, FieldFlow can merge the changes. When they edit the same field with different values, the platform creates a clear conflict for supervisor review rather than silently deleting one person's work.

Not every operation requires the same consistency model. A field observation can usually synchronize later, but reserving the final medicine package, redeeming a voucher, or approving a payment must never happen twice.

FieldFlow therefore separates two types of operations:

1. **Offline and high-volume operations**, such as registrations, observations, device events, and synchronization history.
2. **Critical transactions**, such as inventory reservations, voucher redemption, final approval, and duplicate-action prevention.

This hybrid architecture allows teams to keep working during connectivity problems without sacrificing correctness for sensitive operations.

## How We Are Building It

The frontend is being built as an offline-first Progressive Web App using **Next.js, React, and TypeScript**, and deployed through **Vercel**. A service worker caches the application, while **IndexedDB** stores workflow definitions, local records, and pending operations on the user's device.

**Amazon DynamoDB** manages high-volume synchronization events, device checkpoints, record projections, conflicts, and audit information. **Amazon Aurora DSQL** manages operations that require strongly consistent transactions, including critical approvals, inventory reservations, voucher redemption, and idempotency controls.

The platform also includes a visual workflow builder. Administrators can define forms, roles, states, transitions, permissions, and validation rules without manually developing a new application for every operation.

We are also exploring an AI-assisted workflow generator. An administrator could describe a process in normal language, such as:

> Create an aid-distribution workflow where field workers register households, supervisors verify applications, and each approved household receives only one package.

The AI would generate a draft workflow configuration, but a human administrator would review and approve it before deployment. AI assists with configuration; it does not make final humanitarian or eligibility decisions.

## Challenges We Are Addressing

The greatest challenge is not simply storing information offline. It is ensuring that data collected by several devices can later be synchronized without losing work, creating duplicates, or hiding disagreements.

The main technical challenges include:

- Detecting and resolving concurrent edits
- Preventing duplicate critical actions
- Designing safe synchronization retries
- Supporting changes between workflow versions
- Protecting sensitive information stored on devices
- Maintaining a complete audit history
- Providing a simple interface for nontechnical field workers
- Handling devices that may remain offline for long periods
- Separating eventually consistent operations from strongly consistent transactions

We are designing every synchronization command to be idempotent, meaning that repeating the same request should not repeat the underlying action.

For a command identified by \(c\), the intended behavior is:

$$
f(f(c)) = f(c)
$$

This is especially important when an unstable connection causes a device to send the same operation more than once.

## What We Are Learning

Building FieldFlow is teaching us that offline support cannot be added as a small feature at the end of development. It affects the complete architecture: the data model, user interface, security model, conflict policy, transaction design, and audit system.

We are also learning that different business actions require different guarantees. It would be inefficient to force every field observation through a globally coordinated transaction, but it would be dangerous to handle limited inventory or voucher redemption using only eventual synchronization.

The project is helping us understand how to balance availability, consistency, usability, and operational safety in real-world environments.

## What Makes FieldFlow Different

FieldFlow is not only an offline form builder. It is a workflow compiler and synchronization platform.

It combines:

- Visual operational workflow creation
- Generated offline-first applications
- Conflict-aware synchronization
- Explainable merge decisions
- Strongly consistent critical transactions
- Device and operation audit trails
- Human-readable synchronization monitoring
- AI-assisted—but human-approved—workflow design

Our goal is to help organizations continue serving communities even when the network cannot be trusted.

**Technology should not stop working precisely where it is needed most.**

## Built With

- Next.js
- React
- TypeScript
- Tailwind CSS
- Progressive Web App
- Service Workers
- IndexedDB
- Amazon DynamoDB
- Amazon Aurora DSQL
- AWS Lambda
- Amazon API Gateway
- Amazon Cognito
- DynamoDB Streams
- Vercel
- v0
- Web Crypto API
- Web Workers
- GitHub
- GitHub Actions
