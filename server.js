const cors = require("cors");
app.use(cors());

const express = require("express");
const mercadopago = require("mercadopago");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(cors());

/* ================================
   CONFIGURACIÓN
================================ */

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN
});

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
const BASE_URL = process.env.BASE_URL;

/* ================================
   CREAR PREFERENCIA
================================ */

app.post("/create-preference", async (req, res) => {
  try {
    const { items, customer } = req.body;

    const preference = {
      items: items.map(item => ({
        title: item.name,
        unit_price: Number(item.price),
        quantity: Number(item.quantity),
        currency_id: "ARS"
      })),
      metadata: {
        items,
        customer
      },
      back_urls: {
        success: `${BASE_URL}/success.html`,
        failure: `${BASE_URL}/failure.html`,
        pending: `${BASE_URL}/pending.html`
      },
      auto_return: "approved",
      notification_url: `${BASE_URL}/api/webhook`
    };

    const response = await mercadopago.preferences.create(preference);

    res.json({ init_point: response.body.init_point });

  } catch (error) {
    console.error("Error creando preferencia:", error);
    res.status(500).json({ error: "Error creando preferencia" });
  }
});

/* ================================
   WEBHOOK MERCADO PAGO
================================ */

app.post("/api/webhook", async (req, res) => {
  try {
    if (req.body.type === "payment") {

      const paymentId = req.body.data.id;
      const payment = await mercadopago.payment.findById(paymentId);

      if (payment.body.status === "approved") {

        const metadata = payment.body.metadata;
        await createPrintfulOrder(metadata.items, metadata.customer);

        console.log("Orden creada en Printful");
      }
    }

    res.sendStatus(200);

  } catch (error) {
    console.error("Error en webhook:", error);
    res.sendStatus(500);
  }
});

/* ================================
   CREAR ORDEN EN PRINTFUL
================================ */

async function createPrintfulOrder(items, customer) {
  const response = await axios.post(
    "https://api.printful.com/orders",
    {
      recipient: {
        name: customer.name,
        address1: customer.address1,
        city: customer.city,
        country_code: customer.country_code,
        zip: customer.zip,
        email: customer.email
      },
      items: items.map(item => ({
        sync_variant_id: Number(item.variantId),
        quantity: Number(item.quantity)
      }))
    },
    {
      headers: {
        Authorization: `Bearer ${PRINTFUL_API_KEY}`
      }
    }
  );

  return response.data;
}

/* ================================
   HEALTH CHECK
================================ */

app.get("/", (req, res) => {
  res.send("Backend funcionando");
});

/* ================================
   SERVER
================================ */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto " + PORT);

});
