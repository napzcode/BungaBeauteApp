require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Customer landing page
app.get('/', (req, res) => {
    res.redirect('/booking.html');
});

// Login admin
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'bunga123') {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Username/Password salah!' });
    }
});

// Daftar layanan
app.get('/api/layanan', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM layanan');
        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Dashboard
app.get('/api/dashboard', async (req, res) => {
    try {
        const total = await pool.query(`
            SELECT COUNT(*) as jml FROM booking 
            WHERE EXTRACT(MONTH FROM tgl_acara) = EXTRACT(MONTH FROM CURRENT_DATE)
            AND EXTRACT(YEAR FROM tgl_acara) = EXTRACT(YEAR FROM CURRENT_DATE)
        `);

        const todayBookings = await pool.query(`
            SELECT k.nama_lengkap, l.nama_layanan, b.waktu_acara, b.status_bayar
            FROM booking b
            JOIN klien k ON b.id_klien = k.id_klien
            JOIN detail_booking db ON b.id_booking = db.id_booking
            JOIN layanan l ON db.id_layanan = l.id_layanan
            WHERE b.tgl_acara = CURRENT_DATE
        `);

        const recent = await pool.query(`
            SELECT k.nama_lengkap, l.nama_layanan, b.waktu_acara, b.tgl_acara
            FROM booking b 
            JOIN klien k ON b.id_klien = k.id_klien 
            JOIN detail_booking db ON b.id_booking = db.id_booking 
            JOIN layanan l ON db.id_layanan = l.id_layanan 
            ORDER BY b.id_booking DESC
            LIMIT 5
        `);

        const totalDpQuery = await pool.query(`
            SELECT COALESCE(SUM(dp_dibayar), 0) as total_dp 
            FROM booking 
            WHERE EXTRACT(MONTH FROM tgl_acara) = EXTRACT(MONTH FROM CURRENT_DATE)
            AND EXTRACT(YEAR FROM tgl_acara) = EXTRACT(YEAR FROM CURRENT_DATE)
        `);

        const totalOmsetQuery = await pool.query(`
            SELECT COALESCE(SUM(db.harga_deal), 0) as total_omset 
            FROM booking b 
            JOIN detail_booking db ON b.id_booking = db.id_booking
            WHERE EXTRACT(MONTH FROM b.tgl_acara) = EXTRACT(MONTH FROM CURRENT_DATE)
            AND EXTRACT(YEAR FROM b.tgl_acara) = EXTRACT(YEAR FROM CURRENT_DATE)
        `);

        const dpMasuk = parseFloat(totalDpQuery.rows[0].total_dp);
        const omset = parseFloat(totalOmsetQuery.rows[0].total_omset);
        const sisa = omset - dpMasuk;

        res.json({
            total_booking: parseInt(total.rows[0].jml),
            today_bookings: todayBookings.rows,
            recent_booking: recent.rows,
            dp_masuk: dpMasuk,
            sisa_pelunasan: sisa < 0 ? 0 : sisa
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Data klien
app.get('/api/klien', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM klien ORDER BY id_klien DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Laporan transaksi
app.get('/api/laporan', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT b.id_booking, k.nama_lengkap, b.tgl_acara, b.dp_dibayar, b.status_bayar, b.metode_pembayaran,
                   SUM(db.harga_deal) as total_tagihan
            FROM booking b 
            JOIN klien k ON b.id_klien = k.id_klien 
            JOIN detail_booking db ON b.id_booking = db.id_booking 
            GROUP BY b.id_booking, k.nama_lengkap, b.tgl_acara, b.dp_dibayar, b.status_bayar, b.metode_pembayaran
            ORDER BY b.tgl_acara DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Update status pembayaran
app.put('/api/transaksi/:id', async (req, res) => {
    const { dp_baru, status_baru } = req.body;
    try {
        await pool.query(
            'UPDATE booking SET dp_dibayar = $1, status_bayar = $2 WHERE id_booking = $3',
            [parseFloat(dp_baru), status_baru, req.params.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// Submit booking baru
app.post('/api/booking', async (req, res) => {
    const { nama_lengkap, no_whatsapp, tgl_acara, waktu_acara, lokasi_acara, rombongan, metode_pembayaran } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const insertKlien = await client.query(
            'INSERT INTO klien (nama_lengkap, no_whatsapp) VALUES ($1, $2) RETURNING id_klien',
            [nama_lengkap, no_whatsapp]
        );
        const id_klien = insertKlien.rows[0].id_klien;

        const insertBooking = await client.query(
            `INSERT INTO booking (id_klien, tgl_acara, waktu_acara, lokasi_acara, dp_dibayar, status_bayar, metode_pembayaran)
             VALUES ($1, $2::date, $3::time, $4, 0, 'Menunggu DP', $5) RETURNING id_booking`,
            [id_klien, tgl_acara, waktu_acara, lokasi_acara, metode_pembayaran]
        );
        const id_booking = insertBooking.rows[0].id_booking;

        for (let orang of rombongan) {
            await client.query(
                'INSERT INTO detail_booking (id_booking, nama_klien_detail, id_layanan, harga_deal) VALUES ($1, $2, $3, $4)',
                [id_booking, orang.nama, orang.id_layanan, parseFloat(orang.harga)]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ success: false });
    } finally {
        client.release();
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));
