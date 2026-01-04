export class HelloService {
  greet(name?: string): { message: string } {
    const greeting = name ? `Hello, ${name}!` : "Hello, World!";
    return { message: greeting };
  }
}
