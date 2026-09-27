const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// 모든 상품 조회
router.get('/', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 상품 상세 조회
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 상품 생성 (관리자용)
router.post('/', async (req, res) => {
  try {
    const { name, price, description, image, stock } = req.body;
    const product = new Product({
      name,
      price,
      description,
      image,
      stock
    });
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 상품 수정 (관리자용)
router.put('/:id', async (req, res) => {
  try {
    const { name, price, description, image, stock } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { name, price, description, image, stock },
      { new: true }
    );
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 상품 삭제 (관리자용)
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;