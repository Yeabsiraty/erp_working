from django.core.management.base import BaseCommand

from backend.ledger import services


class Command(BaseCommand):
    help = "ዳታቤዙ ባዶ ከሆነ ምሳሌ መረጃ ይጭናል (ዕቃዎች፣ ሽያጭ፣ ዕዳ፣ ወጪ)።"

    def add_arguments(self, parser):
        parser.add_argument("--clear", action="store_true", help="ምሳሌ መረጃዎችን ሰርዝ")

    def handle(self, *args, **opts):
        if opts["clear"]:
            services.clear_demo()
            self.stdout.write(self.style.SUCCESS("ምሳሌ መረጃዎች ተሰርዘዋል።"))
        elif services.load_demo():
            self.stdout.write(self.style.SUCCESS("ምሳሌ መረጃ ተጭኗል።"))
        else:
            self.stdout.write(self.style.WARNING("ዳታቤዙ ባዶ አይደለም፤ ምንም አልተጫነም።"))
