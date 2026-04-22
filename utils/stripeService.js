import Stripe from "stripe";

const getStripeClient = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!secretKey) {
    const error = new Error("STRIPE_SECRET_KEY is not configured");
    error.statusCode = 500;
    throw error;
  }

  return new Stripe(secretKey);
};

/* Create a Stripe checkout session for subscription renewal */
export const createCheckoutSession = async (
  company_id,
  plan,
  amount,
  currency = "usd",
  successUrl,
  cancelUrl
) => {
  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: `${plan} Photos Subscription`,
              description: `Renew your PestIQ subscription with ${plan} photos`,
            },
            unit_amount: amount, // Already in cents from frontend
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        company_id: company_id.toString(),
        plan: plan,
      },
      client_reference_id: company_id.toString(),
    });

    return session;
  } catch (error) {
    console.error("Stripe session creation error:", error);
    throw error;
  }
};

/* Create a payment intent for direct payments */
export const createPaymentIntent = async (
  company_id,
  amount,
  currency = "usd",
  description = "PestIQ Photo Credits"
) => {
  try {
    const stripe = getStripeClient();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Already in cents from frontend
      currency: currency,
      description: description,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        company_id: company_id.toString(),
      },
    });

    return paymentIntent;
  } catch (error) {
    console.error("Payment intent creation error:", error);
    throw error;
  }
};

/* Retrieve a payment intent */
export const getPaymentIntent = async (paymentIntentId) => {
  try {
    const stripe = getStripeClient();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    console.error("Error retrieving payment intent:", error);
    throw error;
  }
};

/* Retrieve a checkout session */
export const getCheckoutSession = async (sessionId) => {
  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session;
  } catch (error) {
    console.error("Error retrieving checkout session:", error);
    throw error;
  }
};

/* Verify webhook signature */
export const verifyWebhookSignature = (body, signature) => {
  try {
    const stripe = getStripeClient();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

    if (!webhookSecret) {
      const error = new Error("STRIPE_WEBHOOK_SECRET is not configured");
      error.statusCode = 500;
      throw error;
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
    return event;
  } catch (error) {
    console.error("Webhook signature verification error:", error);
    throw error;
  }
};
