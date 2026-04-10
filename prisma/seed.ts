import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const products = [
    { name: 'Laptop', price: 6000 },
    { name: 'Klawiatura', price: 500 },
    { name: 'Myszka', price: 199 }
  ]

  console.log('Start seeding...')
  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { id: 0 },
      update: {},
      create: p,
    })

  }
  
  
  for (const p of products) {
    const existing = await prisma.product.findFirst({
        where: { name: p.name }
    });
    if (!existing) {
        await prisma.product.create({ data: p });
        console.log(`Created product: ${p.name}`);
    } else {
        console.log(`Product already exists: ${p.name}`);
    }
  }

  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
