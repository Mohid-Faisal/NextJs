import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { sendUserApprovedEmail } from '@/lib/email';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = parseInt(id);

    // Validate user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (existingUser.isApproved) {
      return NextResponse.json(
        { error: 'User is already approved' },
        { status: 400 }
      );
    }

    // Approve user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isApproved: true,
        status: 'ACTIVE',
        approvedAt: new Date(),
        approvedBy: 1, // TODO: Get actual admin user ID from session
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        isApproved: true,
        createdAt: true,
      }
    });

    // Send approval confirmation email to user
    try {
      await sendUserApprovedEmail(updatedUser.email, updatedUser.name);
    } catch (emailError) {
      console.error('Failed to send approval confirmation email:', emailError);
      // Don't fail approval if email fails
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error approving user:', error);
    return NextResponse.json(
      { error: 'Failed to approve user' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
