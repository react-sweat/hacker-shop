import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const connectionString = process.env.DATABASE_URL
const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })


async function main() {
  console.log('Start seeding...')

  const adminUsername = 'admin'
  const adminEmail = 'admin@hacker-shop.local'
  const adminPlainPassword = 'password67'
  const adminHashedPassword = await bcrypt.hash(adminPlainPassword, 10)

  await prisma.user.upsert({
    where: { username: adminUsername },
    update: {
      email: adminEmail,
      password: adminHashedPassword,
      role: 'ADMIN',
    },
    create: {
      username: adminUsername,
      email: adminEmail,
      password: adminHashedPassword,
      role: 'ADMIN',
    },
  })
  
  
  const categories = [
    { name: 'Computers' },
    { name: 'Peripherals' }
  ]

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    })
  }

  const computers = await prisma.category.findUnique({ where: { name: 'Computers' } })
  const peripherals = await prisma.category.findUnique({ where: { name: 'Peripherals' } })

  const products = [
    { 
      name: 'Laptop', 
      price: 6000, 
      description: 'High-performance laptop', 
      stock: 10,
      categoryId: computers?.id ?? null
    },
    { 
      name: 'Klawiatura', 
      price: 500, 
      description: 'Mechanical keyboard', 
      stock: 25,
      categoryId: peripherals?.id ?? null
    },
    { 
      name: 'Myszka', 
      price: 199, 
      description: 'Wireless mouse', 
      stock: 50,
      categoryId: peripherals?.id ?? null
    }
  ]

  
  await prisma.orderItem.deleteMany()
  await prisma.product.deleteMany()

  for (const p of products) {
    await prisma.product.create({
      data: p
    })
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
