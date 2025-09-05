# Inactive Customers Management System

This system automatically identifies and manages customers who haven't had any shipments in over a year, marking them as inactive and notifying administrators.

## Features

- **Automatic Detection**: Identifies customers with no shipments in the past year
- **Email Notifications**: Sends detailed email reports to administrators
- **Manual Management**: Admin interface to view and reactivate customers
- **Scheduled Jobs**: Automated weekly checks via Vercel Cron
- **Customer Reactivation**: Easy one-click reactivation of customers

## API Endpoints

### 1. Check Inactive Customers (Manual)
- **POST** `/api/customers/check-inactive`
- **GET** `/api/customers/check-inactive` (preview without updating)

### 2. Customer Reactivation
- **POST** `/api/customers/reactivate`
- **GET** `/api/customers/reactivate` (list inactive customers)

### 3. Scheduled Cron Job
- **GET** `/api/cron/check-inactive-customers`

## Setup Instructions

### 1. Environment Variables

Add these environment variables to your `.env.local` file:

```env
# Admin email for notifications
ADMIN_EMAIL=your-admin@email.com

# Optional: Secret for cron job security
CRON_SECRET=your-secret-key
```

### 2. Vercel Cron Configuration

The system is configured to run automatically every Monday at 9:00 AM UTC via Vercel Cron. The configuration is in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-inactive-customers",
      "schedule": "0 9 * * 1"
    }
  ]
}
```

### 3. Manual Testing

You can test the system manually by:

1. **Preview inactive customers** (without updating):
   ```bash
   curl -X GET http://localhost:3000/api/customers/check-inactive
   ```

2. **Run the check and update customers**:
   ```bash
   curl -X POST http://localhost:3000/api/customers/check-inactive
   ```

3. **List inactive customers**:
   ```bash
   curl -X GET http://localhost:3000/api/customers/reactivate
   ```

4. **Reactivate a customer**:
   ```bash
   curl -X POST http://localhost:3000/api/customers/reactivate \
     -H "Content-Type: application/json" \
     -d '{"customerId": 123}'
   ```

## Admin Interface

Access the admin interface at `/dashboard/customers/inactive` to:

- View all inactive customers
- Reactivate customers with one click
- Manually trigger the inactive customer check
- See detailed customer information including last shipment date

## How It Works

### 1. Detection Logic

The system identifies inactive customers by:
- Finding customers with `ActiveStatus = "Active"` who have been customers for over a year
- For each customer, calculating one year from their `createdAt` date
- Checking if they have any invoices with shipments after that calculated date
- Using the relationship: `Customers -> Invoices -> Shipments`

**Important**: The system only considers customers who have been customers for over a year. New customers (less than a year old) are never marked as inactive, regardless of their shipment activity.

**Example**:
- Customer A became a customer on January 1, 2023
- Current date is January 15, 2024
- System calculates: January 1, 2023 + 1 year = January 1, 2024
- System checks if Customer A has any shipments after January 1, 2024
- If no shipments after January 1, 2024, Customer A is marked as inactive

- Customer B became a customer on December 1, 2023
- Current date is January 15, 2024
- Customer B has only been a customer for 1.5 months
- Customer B is NOT considered for inactive status (too new)

### 2. Email Notifications

When customers are marked as inactive, the system sends a detailed email to the admin containing:
- List of all customers marked as inactive
- Company name, contact person, email
- Last shipment date and customer since date
- Recommendations for next steps

### 3. Database Updates

- Updates `ActiveStatus` from "Active" to "Inactive"
- Preserves all customer data and history
- Maintains relationships with invoices and shipments

## Customization

### Changing the Time Period

To change from 1 year to a different period, modify the date calculation in the API files:

```typescript
// Change from 1 year to 6 months
const sixMonthsAgo = new Date();
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
```

### Changing the Cron Schedule

Update the `vercel.json` file to change the schedule:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-inactive-customers",
      "schedule": "0 9 * * 1"  // Every Monday at 9 AM
    }
  ]
}
```

Common cron patterns:
- `0 9 * * 1` - Every Monday at 9 AM
- `0 9 1 * *` - First day of every month at 9 AM
- `0 9 * * 0` - Every Sunday at 9 AM

### Email Template Customization

Modify the email templates in the API files to match your branding and requirements.

## Monitoring

### Logs

The system logs all activities:
- Customer detection and updates
- Email sending status
- Errors and exceptions

### Email Notifications

Check your admin email for:
- Weekly automated reports
- Immediate notifications when customers are marked inactive
- Error notifications if the system fails

## Troubleshooting

### Common Issues

1. **No customers being marked as inactive**
   - Check if customers have invoices with shipments
   - Verify the date calculation logic
   - Check database relationships

2. **Email notifications not working**
   - Verify `ADMIN_EMAIL` environment variable
   - Check Resend API key configuration
   - Check email logs for errors

3. **Cron job not running**
   - Verify Vercel deployment has cron enabled
   - Check `vercel.json` configuration
   - Verify the cron endpoint is accessible

### Testing

Use the manual endpoints to test the system:
1. First run the GET endpoint to preview
2. Then run the POST endpoint to execute
3. Check the admin interface to verify results

## Security

- The cron endpoint can be protected with a secret key
- All database operations use Prisma with proper error handling
- Email sending has error handling to prevent system failures
