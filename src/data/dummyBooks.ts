const englishParagraphs = [
  "In my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since.",
  "'Whenever you feel like criticizing any one,' he told me, 'just remember that all the people in this world haven't had the advantages that you've had.'",
  "He didn't say any more, but we've always been unusually communicative in a reserved way, and I understood that he meant a great deal more than that.",
  "In consequence, I'm inclined to reserve all judgments, a habit that has opened up many curious natures to me and also made me the victim of not a few veteran bores.",
  "The abnormal mind is quick to detect and attach itself to this quality when it appears in a normal person.",
  "And so it came about that in college I was unjustly accused of being a politician, because I was privy to the secret griefs of wild, unknown men.",
  "Most of the confidences were unsought—frequently I have feigned sleep, preoccupation, or a hostile levity when I realized by some unmistakable sign that an intimate revelation was quivering on the horizon.",
  "For the intimate revelations of young men, or at least the terms in which they express them, are usually plagiaristic and marred by obvious suppressions.",
  "Reserving judgments is a matter of infinite hope. I am still a little afraid of missing something if I forget that, as my father snobbishly suggested, and I snobbishly repeat, a sense of the fundamental decencies is parcelled out unequally at birth."
];

const georgianParagraphs = [
  "ჩემს ახალგაზრდობაში, როცა გაცილებით მიამიტი და დაუცველი ვიყავი, მამაჩემმა ერთი რჩევა მომცა, რომელიც დღემდე თავიდან არ ამომდის.",
  "'როდესაც გადაწყვეტ, რომ ვინმე გააკრიტიკო', მითხრა მან, 'ყოველთვის გახსოვდეს, რომ ამ ქვეყნად ყველას არ ჰქონია ის უპირატესობები, რაც შენ გქონდა.'",
  "მეტი არაფერი უთქვამს, მაგრამ რადგან ჩვენ ყოველთვის უსიტყვოდ გვესმოდა ერთმანეთის, მივხვდი, რომ იგი გაცილებით მეტს გულისხმობდა.",
  "ამის გამო მივეჩვიე ნაადრევი დასკვნებისგან თავის შეკავებას, რამაც უამრავი საინტერესო ადამიანის გაცნობის საშუალება მომცა.",
  "და ასევე არაერთი მოსაწყენი პიროვნების მსხვერპლად მაქცია. გაუწონასწორებელი გონება სწრაფად ამჩნევს და ეკვრის ამ თვისებას ნორმალურ ადამიანში.",
  "სწორედ ამიტომ მოხდა, რომ კოლეჯში უსამართლოდ დამდეს ბრალი პოლიტიკოსობაში, რადგან უცნობი, ველური ბიჭების საიდუმლო დარდის თანაზიარი ვიყავი.",
  "უმეტესწილად ამ აღსარებებს არავის ვთხოვდი — ხშირად ვიმთვალუნებდი, ან ვჩვენებდი, თითქოს საქმეში ვიყავი გართული.",
  "ახალგაზრდა კაცების გულახდილი საუბრები ძირითადად პლაგიატია და აშკარა თავშეკავებითაა დამახინჯებული.",
  "დასკვნებისგან თავის შეკავება უსასრულო იმედის საკითხია. ახლაც მეშინია, რამე არ გამომრჩეს, თუ დავივიწყებ მამაჩემის სნობურ ნათქვამს (რომელსაც ასევე სნობურად ვიმეორებ)."
];

const generateBook = (paragraphs: string[], prefix: string) => {
  const result: { id: string; content: string; page: number }[] = [];
  let page = 1;
  // Repeat the paragraphs 30 times to create a large book (270 paragraphs)
  for (let repetition = 0; repetition < 30; repetition++) {
    for (let i = 0; i < paragraphs.length; i++) {
      result.push({
        id: `${prefix}_${repetition}_${i}`,
        content: paragraphs[i],
        page: page
      });
      // Increment page every 10 paragraphs
      if (result.length % 10 === 0) {
        page++;
      }
    }
  }
  return result;
};

export const book1Content = generateBook(englishParagraphs, 'en');
export const book2Content = generateBook(georgianParagraphs, 'ge');

export const getBookContent = (bookId: string) => {
  if (bookId === '1') return book1Content;
  if (bookId === '2') return book2Content;
  // Default to Georgian book for any other ID
  return book2Content;
};
